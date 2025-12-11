const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const uiDir = path.join(repoRoot, 'ui');
const outDir = path.join(repoRoot, 'desktop', 'renderer');

function run(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env });
  if (r.error) throw r.error;
  if (typeof r.status === 'number' && r.status !== 0) {
    process.exit(r.status);
  }
}

// 1) 构建前端
const apiBase = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
run('npm', ['run', 'build'], uiDir, {
  ...process.env,
  VITE_API_BASE_URL: apiBase,
});

// 2) 清空旧 renderer 并复制 dist
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
run('cp', ['-R', path.join(uiDir, 'dist', '/'), outDir], uiDir);

console.log(`[build-frontend] renderer updated from ui/dist (VITE_API_BASE_URL=${apiBase})`);
