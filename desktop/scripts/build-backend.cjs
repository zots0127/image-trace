const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function repoRoot() {
  // desktop -> repo root
  return path.resolve(process.cwd(), '..');
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (typeof r.status === 'number' && r.status !== 0) {
    process.exit(r.status);
  }
}

function detectPython() {
  for (const c of ['python', 'python3']) {
    const r = spawnSync(c, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) return c;
  }
  throw new Error('未找到 python/python3。请在构建机安装 Python 3.11+（仅构建时需要，用户不需要）。');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

const root = repoRoot();
const backendDir = path.join(root, 'backend_simplified');
const entry = path.join(backendDir, 'run_server.py');

if (!fs.existsSync(entry)) {
  throw new Error(`缺少入口文件：${entry}`);
}

const outDir = path.join(root, 'desktop', 'backend_bin');
const workDir = path.join(root, 'desktop', '.pyinstaller-build');
const specDir = path.join(root, 'desktop', '.pyinstaller-spec');
ensureDir(outDir);
ensureDir(workDir);
ensureDir(specDir);

const py = detectPython();
console.log('[build-backend] using', py);

// 说明：默认不自动安装依赖，避免污染全局 Python。
// 请在构建机先创建 venv 并安装：
//   pip install -r backend_simplified/requirements.txt
//   pip install pyinstaller
// 然后再运行本脚本。
run(py, ['-m', 'PyInstaller', '--version'], backendDir);

const baseName = 'image-trace-backend';
const exeName = process.platform === 'win32' ? `${baseName}.exe` : baseName;

run(py, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onefile',
  '--name', baseName,
  '--distpath', outDir,
  '--workpath', workDir,
  '--specpath', specDir,
  '--paths', backendDir,
  entry,
], backendDir);

const builtPath = path.join(outDir, exeName);
if (!fs.existsSync(builtPath)) {
  throw new Error(`后端可执行文件未生成：${builtPath}`);
}

console.log('[build-backend] OK:', builtPath);
