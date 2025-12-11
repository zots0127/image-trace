function $(id) {
  return document.getElementById(id);
}

const DEFAULT_API = 'http://localhost:8000';

const state = {
  apiBaseUrl: DEFAULT_API,
  projects: [],
  currentProjectId: null,
  images: [],
};

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function getApiBase() {
  return state.apiBaseUrl.replace(/\/$/, '');
}

function toStaticUrl(filePath) {
  // file_path 相对于 data：uploads/xxx.jpg 或 extracted/xxx.jpg
  const fp = String(filePath || '').startsWith('data/')
    ? String(filePath).slice('data/'.length)
    : String(filePath || '');
  return `${getApiBase()}/static/${encodePath(fp)}`;
}

async function apiRequest(endpoint, options = {}) {
  const url = `${getApiBase()}${endpoint}`;
  const finalOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };

  const res = await fetch(url, finalOptions);
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let detail = '';
    if (contentType.includes('application/json')) {
      try {
        const j = await res.json();
        detail = j.detail || j.message || JSON.stringify(j);
      } catch {
        detail = await res.text();
      }
    } else {
      detail = await res.text();
    }
    throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
  }

  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.text();
}

function setHealth(status, text) {
  const dot = $('healthDot');
  dot.className = 'dot';
  if (status === 'good') dot.classList.add('good');
  if (status === 'bad') dot.classList.add('bad');
  if (status === 'warn') dot.classList.add('warn');
  $('healthText').textContent = text;
}

function showMsg(id, text) {
  $(id).textContent = text || '';
}

function appendLog(line) {
  const el = $('uploadLog');
  const now = new Date().toLocaleTimeString('zh-CN');
  el.textContent = `${el.textContent}${el.textContent ? '\n' : ''}[${now}] ${line}`;
  el.scrollTop = el.scrollHeight;
}

async function healthCheck() {
  const r = await apiRequest('/health');
  return r;
}

async function loadProjects() {
  const projects = await apiRequest('/projects');
  state.projects = projects;

  // select
  const sel = $('projectSelect');
  sel.innerHTML = '';

  if (!projects.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '（暂无项目）';
    sel.appendChild(opt);
    state.currentProjectId = null;
    renderProjectsList();
    await loadImages();
    return;
  }

  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = String(p.id);
    opt.textContent = `${p.name}（ID: ${p.id}）`;
    sel.appendChild(opt);
  });

  // 维持当前选择
  const existing = projects.find((p) => String(p.id) === String(state.currentProjectId));
  if (existing) {
    sel.value = String(existing.id);
  } else {
    sel.value = String(projects[0].id);
    state.currentProjectId = projects[0].id;
  }

  renderProjectsList();
  await loadImages();
}

function renderProjectsList() {
  const root = $('projectsList');
  root.innerHTML = '';

  state.projects.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'item';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="itemTitle">${escapeHtml(p.name)}</div>
      <div class="itemSub">ID: ${p.id}${p.description ? ` · ${escapeHtml(p.description)}` : ''}</div>
    `;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';

    const btnUse = document.createElement('button');
    btnUse.className = 'btn';
    btnUse.textContent = '使用';
    btnUse.onclick = async () => {
      state.currentProjectId = p.id;
      $('projectSelect').value = String(p.id);
      await loadImages();
    };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn danger';
    btnDel.textContent = '删除';
    btnDel.onclick = async () => {
      if (!confirm(`确定删除项目「${p.name}」吗？`)) return;
      await apiRequest(`/projects/${p.id}`, { method: 'DELETE' });
      await loadProjects();
    };

    right.appendChild(btnUse);
    right.appendChild(btnDel);

    div.appendChild(left);
    div.appendChild(right);
    root.appendChild(div);
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function createProject() {
  const name = $('newProjectName').value.trim();
  const description = $('newProjectDesc').value.trim();

  if (!name) {
    showMsg('projectMsg', '请填写项目名称');
    return;
  }

  showMsg('projectMsg', '创建中...');
  const p = await apiRequest('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || null }),
  });

  $('newProjectName').value = '';
  $('newProjectDesc').value = '';
  showMsg('projectMsg', `已创建：${p.name}（ID: ${p.id}）`);
  await loadProjects();
}

async function loadImages() {
  const projectId = state.currentProjectId;
  if (!projectId) {
    state.images = [];
    renderImages();
    return;
  }

  const images = await apiRequest(`/images/${projectId}`);
  state.images = images;
  renderImages();
}

function renderImages() {
  const root = $('imagesGrid');
  root.innerHTML = '';

  if (!state.currentProjectId) {
    root.innerHTML = '<div class="muted">请先创建/选择项目。</div>';
    return;
  }

  if (!state.images.length) {
    root.innerHTML = '<div class="muted">暂无图片。上传图片或上传文档后会自动提取图片。</div>';
    return;
  }

  state.images.forEach((img) => {
    const card = document.createElement('div');
    card.className = 'imgCard';

    const thumb = document.createElement('div');
    thumb.className = 'imgThumb';

    const imageEl = document.createElement('img');
    imageEl.src = toStaticUrl(img.file_path);
    imageEl.alt = img.filename;
    imageEl.loading = 'lazy';
    imageEl.onerror = () => {
      thumb.textContent = '预览失败';
    };

    thumb.appendChild(imageEl);

    const body = document.createElement('div');
    body.className = 'imgBody';

    const name = document.createElement('div');
    name.className = 'imgName';
    name.textContent = img.filename;

    const meta = document.createElement('div');
    meta.className = 'imgMeta';
    meta.textContent = `ID: ${img.id} · ${img.file_path}`;

    const btns = document.createElement('div');
    btns.className = 'imgBtns';

    const btnOpen = document.createElement('button');
    btnOpen.className = 'btn';
    btnOpen.textContent = '打开';
    btnOpen.onclick = () => window.open(toStaticUrl(img.file_path), '_blank');

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn danger';
    btnDelete.textContent = '删除';
    btnDelete.onclick = async () => {
      if (!confirm(`确定删除图片「${img.filename}」吗？`)) return;
      await apiRequest(`/images/${img.id}`, { method: 'DELETE' });
      await loadImages();
    };

    btns.appendChild(btnOpen);
    btns.appendChild(btnDelete);

    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(btns);

    card.appendChild(thumb);
    card.appendChild(body);
    root.appendChild(card);
  });
}

async function uploadSelectedFiles() {
  const projectId = state.currentProjectId;
  if (!projectId) {
    showMsg('uploadMsg', '请先选择项目');
    return;
  }

  const input = $('fileInput');
  const files = Array.from(input.files || []);
  if (!files.length) {
    showMsg('uploadMsg', '请选择至少一个文件');
    return;
  }

  showMsg('uploadMsg', `准备上传 ${files.length} 个文件...`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    appendLog(`上传中（${i + 1}/${files.length}）：${f.name}`);

    const fd = new FormData();
    fd.append('project_id', String(projectId));
    fd.append('file', f);

    try {
      const r = await apiRequest('/upload', { method: 'POST', body: fd, headers: {} });
      appendLog(`完成：${f.name} · 类型=${r.file_type} · 产生图片=${(r.processed_images || []).length}`);
    } catch (e) {
      appendLog(`失败：${f.name} · ${e.message}`);
    }
  }

  input.value = '';
  showMsg('uploadMsg', '上传完成（详见上传日志）');
  await loadImages();
  await loadProjects();
}

async function compareProject() {
  const projectId = state.currentProjectId;
  if (!projectId) {
    showMsg('compareMsg', '请先选择项目');
    return;
  }

  const threshold = Number($('threshold').value);
  const hashType = $('hashType').value;

  if (!(threshold >= 0 && threshold <= 1)) {
    showMsg('compareMsg', '阈值必须在 0-1 之间');
    return;
  }

  showMsg('compareMsg', '分组中...');
  $('compareResult').textContent = '';

  const fd = new FormData();
  fd.append('threshold', String(threshold));
  fd.append('hash_type', hashType);

  const r = await apiRequest(`/compare/${projectId}`, { method: 'POST', body: fd, headers: {} });

  // 简要展示
  const groups = r.groups || [];
  const unique = r.unique_images || [];

  const summary = {
    project_id: r.project_id,
    total_images: r.total_images,
    group_count: groups.length,
    unique_count: unique.length,
    groups: groups.map((g) => ({
      group_id: g.group_id,
      similarity_score: g.similarity_score,
      images: (g.images || []).map((img) => ({ id: img.id, filename: img.filename, file_path: img.file_path })),
    })),
    unique_images: unique.map((img) => ({ id: img.id, filename: img.filename, file_path: img.file_path })),
  };

  $('compareResult').textContent = JSON.stringify(summary, null, 2);
  showMsg('compareMsg', '完成');
}

function bindUi() {
  // API base
  const saved = localStorage.getItem('apiBaseUrl');
  state.apiBaseUrl = saved || DEFAULT_API;
  $('apiBaseUrl').value = state.apiBaseUrl;

  $('apiBaseUrl').addEventListener('change', async () => {
    state.apiBaseUrl = $('apiBaseUrl').value.trim() || DEFAULT_API;
    localStorage.setItem('apiBaseUrl', state.apiBaseUrl);
    setHealth('warn', '已更改地址，建议重新检测');
    await loadProjects();
  });

  $('btnHealth').onclick = async () => {
    try {
      setHealth('warn', '检测中...');
      const r = await healthCheck();
      setHealth('good', `正常（v${r.version || 'unknown'}）`);
    } catch (e) {
      setHealth('bad', `不可用：${e.message}`);
    }
  };

  $('btnReloadProjects').onclick = loadProjects;
  $('btnCreateProject').onclick = createProject;
  $('btnReloadImages').onclick = loadImages;
  $('btnUpload').onclick = uploadSelectedFiles;
  $('btnCompare').onclick = compareProject;

  $('projectSelect').addEventListener('change', async () => {
    const v = $('projectSelect').value;
    state.currentProjectId = v ? Number(v) : null;
    await loadImages();
  });

  // Electron-only actions
  const hasDesktop = !!window.imageTraceDesktop;
  $('btnStart').disabled = !hasDesktop;
  $('btnStop').disabled = !hasDesktop;
  $('btnOpenData').disabled = !hasDesktop;

  if (hasDesktop) {
    $('btnStart').onclick = async () => {
      showMsg('uploadMsg', '正在启动内置后端...');
      const r = await window.imageTraceDesktop.startBackend();
      if (r.ok) {
        if (r.baseUrl) {
          state.apiBaseUrl = r.baseUrl;
          $('apiBaseUrl').value = r.baseUrl;
          localStorage.setItem('apiBaseUrl', r.baseUrl);
        }
        showMsg('uploadMsg', '后端已启动');
      } else {
        showMsg('uploadMsg', `启动失败：${r.error || 'unknown error'}`);
      }
      $('btnHealth').click();
      await loadProjects();
    };

    $('btnStop').onclick = async () => {
      const r = await window.imageTraceDesktop.stopBackend();
      if (r.ok) {
        showMsg('uploadMsg', '后端已停止');
      } else {
        showMsg('uploadMsg', `停止失败：${r.error || 'unknown error'}`);
      }
      setHealth('warn', '已停止/未知');
    };

    $('btnOpenData').onclick = async () => {
      await window.imageTraceDesktop.openDataDir();
    };

    window.imageTraceDesktop.getBackendInfo().then((info) => {
      $('runtimeText').textContent = info.baseUrl
        ? `后端：${info.baseUrl}${info.managed ? '（内置）' : '（外部）'}`
        : '内置后端：未启动';
    }).catch(() => {
      $('runtimeText').textContent = '内置后端：未启动';
    });
  } else {
    $('runtimeText').textContent = '运行在浏览器模式（无桌面能力）';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  bindUi();
  try {
    $('btnHealth').click();
  } catch {
    // ignore
  }

  try {
    await loadProjects();
  } catch (e) {
    showMsg('projectMsg', `无法加载项目：${e.message}`);
  }

  // 桌面版：尽量自动启动内置后端并切到正确的 baseUrl
  if (window.imageTraceDesktop) {
    try {
      const r = await window.imageTraceDesktop.startBackend();
      if (r.ok && r.baseUrl) {
        state.apiBaseUrl = r.baseUrl;
        $('apiBaseUrl').value = r.baseUrl;
        localStorage.setItem('apiBaseUrl', r.baseUrl);
        $('runtimeText').textContent = `内置后端：${r.baseUrl}`;
        $('btnHealth').click();
        await loadProjects();
      }
    } catch {
      // ignore
    }
  }
});
