const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const net = require('net');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

function isDev() {
  return !app.isPackaged;
}

function getRuntimeDir() {
  return path.join(app.getPath('userData'), 'runtime');
}

function getRuntimeDataDir() {
  return path.join(getRuntimeDir(), 'data');
}

function getRuntimeLogPath() {
  return path.join(getRuntimeDir(), 'backend.log');
}

function getBackendExeName() {
  return process.platform === 'win32' ? 'image-trace-backend.exe' : 'image-trace-backend';
}

function getBackendBinaryPath() {
  // 打包后：extraResources -> process.resourcesPath/backend_bin/<exe>
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend_bin', getBackendExeName());
  }
  // 开发：优先使用 PyInstaller 生成物；没有就回退到 python 启动
  return path.join(__dirname, 'backend_bin', getBackendExeName());
}

async function ensureRuntimeDirs() {
  await fsp.mkdir(getRuntimeDir(), { recursive: true });
  await fsp.mkdir(getRuntimeDataDir(), { recursive: true });
  await fsp.mkdir(path.join(getRuntimeDataDir(), 'uploads'), { recursive: true });
  await fsp.mkdir(path.join(getRuntimeDataDir(), 'extracted'), { recursive: true });
}

async function getFreePort(prefer = 8000) {
  const canUse = (port) =>
    new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => s.close(() => resolve(true)));
      s.listen(port, '127.0.0.1');
    });

  if (await canUse(prefer)) return prefer;

  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : prefer;
      s.close(() => resolve(port));
    });
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d.toString('utf-8')));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(1500, () => req.destroy(new Error('timeout')));
  });
}

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      await httpGetJson(`${baseUrl}/health`);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr || new Error('health check timeout');
}

let backendProc = null;
let backendBaseUrl = null;
let backendPort = null;
let backendManaged = false;

async function startBackendInternal() {
  if (backendProc && backendBaseUrl) {
    // 已经启动：再确认一次健康
    await waitForHealth(backendBaseUrl, 3000).catch(() => {});
    return { baseUrl: backendBaseUrl, port: backendPort };
  }

  await ensureRuntimeDirs();

  // dev 场景：如果本机已经有后端在 8000（例如你用 docker 起了），直接复用
  if (!app.isPackaged) {
    const tryUrl = 'http://127.0.0.1:8000';
    try {
      await waitForHealth(tryUrl, 800);
      backendProc = null;
      backendManaged = false;
      backendBaseUrl = tryUrl;
      backendPort = 8000;
      return { baseUrl: backendBaseUrl, port: backendPort };
    } catch {
      // ignore
    }
  }

  const port = await getFreePort(8000);
  const baseUrl = `http://127.0.0.1:${port}`;

  const logStream = fs.createWriteStream(getRuntimeLogPath(), { flags: 'a' });
  const env = {
    ...process.env,
    IMAGE_TRACE_HOST: '127.0.0.1',
    IMAGE_TRACE_PORT: String(port),
    IMAGE_TRACE_DATA_DIR: getRuntimeDataDir(),
    IMAGE_TRACE_LOG_LEVEL: 'info',
  };

  const exePath = getBackendBinaryPath();
  let child;

  if (fs.existsSync(exePath)) {
    // mac/linux: 确保可执行权限（有些打包链路会丢失 chmod）
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(exePath, 0o755);
      } catch {
        // ignore
      }
    }
    child = spawn(exePath, [], {
      cwd: getRuntimeDir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    backendManaged = true;
  } else if (isDev()) {
    // 开发兜底：用 python 直接跑（构建机可用，不要求用户机器）
    const pyCandidates = process.platform === 'win32' ? ['python'] : ['python3', 'python'];
    let py = null;
    for (const c of pyCandidates) {
      const r = spawnSync(c, ['--version'], { stdio: 'ignore' });
      if (r.status === 0) {
        py = c;
        break;
      }
    }
    if (!py) {
      throw new Error('未找到内置后端可执行文件，且开发模式下也未检测到 python。请先运行 npm run build:backend。');
    }

    const backendDir = path.resolve(__dirname, '..', 'backend_simplified');
    child = spawn(py, ['run_server.py'], {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    backendManaged = true;
  } else {
    throw new Error(`内置后端可执行文件不存在：${exePath}`);
  }

  child.stdout.on('data', (d) => logStream.write(d));
  child.stderr.on('data', (d) => logStream.write(d));
  child.on('exit', () => {
    backendProc = null;
    backendBaseUrl = null;
    backendPort = null;
  });

  backendProc = child;
  backendBaseUrl = baseUrl;
  backendPort = port;

  await waitForHealth(baseUrl, 20000);
  return { baseUrl, port };
}

async function stopBackendInternal() {
  if (!backendProc) return;
  if (!backendManaged) return;

  const p = backendProc;
  backendProc = null;
  backendBaseUrl = null;
  backendPort = null;
  backendManaged = false;

  try {
    p.kill('SIGTERM');
  } catch {
    // ignore
  }

  await new Promise((r) => setTimeout(r, 800));
  if (!p.killed) {
    try {
      p.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#0b1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 任何新窗口都交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('backend:start', async () => {
  try {
    const { baseUrl, port } = await startBackendInternal();
    return { ok: true, baseUrl, port };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('backend:stop', async () => {
  try {
    if (!backendManaged) {
      return { ok: false, error: '当前后端不是由桌面端启动（无法停止）。' };
    }
    await stopBackendInternal();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('backend:info', async () => {
  return {
    baseUrl: backendBaseUrl,
    port: backendPort,
    logPath: getRuntimeLogPath(),
    dataDir: getRuntimeDataDir(),
    managed: backendManaged,
  };
});

ipcMain.handle('backend:openDataDir', async () => {
  await ensureRuntimeDirs();
  await shell.openPath(getRuntimeDataDir());
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendInternal().catch(() => {});
});
