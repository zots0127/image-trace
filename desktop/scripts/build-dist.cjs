const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Usage: node scripts/build-dist.cjs <pyinstaller|nuitka>

const flavor = process.argv[2];
if (!flavor || !['pyinstaller', 'nuitka'].includes(flavor.toLowerCase())) {
  console.error('Usage: node scripts/build-dist.cjs <pyinstaller|nuitka>');
  process.exit(1);
}

const flavorCap = flavor.toLowerCase() === 'pyinstaller' ? 'PyInstaller' : 'Nuitka';

// Construct artifact name template for electron-builder
// We pass this literal string to electron-builder, which performs the substitution.
const artifactName = `\${productName}-${flavorCap}-\${version}-\${os}-\${arch}.\${ext}`;

console.log(`[build-dist] Flavor: ${flavorCap}`);
console.log(`[build-dist] Artifact Name Pattern: ${artifactName}`);

const projectRoot = path.resolve(__dirname, '..');
const electronBuilderBin = path.join(projectRoot, 'node_modules', '.bin', 'electron-builder');
const cmd = process.platform === 'win32' ? `${electronBuilderBin}.cmd` : electronBuilderBin;

const args = [
  '--publish', 'never',
  `-c.artifactName=${artifactName}`
];

console.log(`[build-dist] Executing: ${cmd} ${args.join(' ')}`);

const r = spawnSync(cmd, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false 
});

if (r.status !== 0) {
  console.error(`[build-dist] Build failed with status ${r.status}`);
  process.exit(r.status || 1);
}

