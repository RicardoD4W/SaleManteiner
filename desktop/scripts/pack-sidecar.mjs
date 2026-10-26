import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '..');
const REPO = path.resolve(DESKTOP, '..');

const BINARIES = path.join(DESKTOP, 'binaries');
const RESOURCES = path.join(DESKTOP, 'resources');

const TARGET = 'x86_64-pc-windows-msvc';
const SIDECAR = `salemanteiner-server-${TARGET}.exe`;

function log(msg) {
  console.log(`[pack] ${msg}`);
}

function fail(msg) {
  console.error(`[pack] ERROR: ${msg}`);
  process.exit(1);
}

function dirSizeMB(dir) {
  let total = 0;
  const walk = (current) => {
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(dir);
  return total / (1024 * 1024);
}

function resetDir(dir) {
  mkdirSync(dir, { recursive: true });
  for (const item of readdirSync(dir)) {
    rmSync(path.join(dir, item), { recursive: true, force: true, maxRetries: 15, retryDelay: 300 });
  }
}

log('limpiando el destino');
resetDir(BINARIES);
resetDir(path.join(RESOURCES, 'server'));
resetDir(path.join(RESOURCES, 'web'));

log('copiando el runtime de node como sidecar');
const nodeExe = process.execPath;
if (!existsSync(nodeExe)) fail(`no encuentro el node en ${nodeExe}`);
cpSync(nodeExe, path.join(BINARIES, SIDECAR));
log(
  `  ${SIDECAR} (${(statSync(path.join(BINARIES, SIDECAR)).size / (1024 * 1024)).toFixed(1)} MiB)`,
);

const serverDist = path.join(REPO, 'server', 'dist');
if (!existsSync(serverDist)) fail('falta server/dist → corré `npm run build:server` primero');
cpSync(serverDist, path.join(RESOURCES, 'server', 'dist'), { recursive: true });
log('  server/dist ✓');

let serverPkg;
try {
  serverPkg = JSON.parse(readFileSync(path.join(REPO, 'server', 'package.json'), 'utf8'));
} catch (err) {
  fail(`no puedo leer server/package.json: ${err.message}`);
}
const runtimeDir = path.join(RESOURCES, 'server');
writeFileSync(
  path.join(runtimeDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'salemanteiner-server-runtime',
      version: serverPkg.version,
      private: true,
      type: 'module',
      dependencies: serverPkg.dependencies,
    },
    null,
    2,
  )}\n`,
);
log('  instalando las dependencias de runtime (npm, solo prod)');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  execFileSync(
    npmCmd,
    ['install', '--omit=dev', '--no-package-lock', '--no-audit', '--no-fund', '--loglevel=error'],
    { cwd: runtimeDir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
} catch (err) {
  fail(`falló el npm install de las dependencias de runtime: ${err.message}`);
}

log('  escribiendo el manifiesto de versiones');
try {
  execFileSync(
    process.execPath,
    [path.join(REPO, 'scripts', 'write-versions.mjs'), '--target', runtimeDir],
    { stdio: 'inherit' },
  );
} catch (err) {
  fail(`no pude escribir el manifiesto de versiones: ${err.message}`);
}

const webDist = path.join(REPO, 'web', 'dist');
if (!existsSync(webDist)) fail('falta web/dist → corré `npm run build:web` primero');
cpSync(webDist, path.join(RESOURCES, 'web'), { recursive: true });
log('  web/dist ✓');

log('listo:');
log(`  sidecar: desktop/binaries/${SIDECAR}`);
log(
  `  recursos: desktop/resources/server (${dirSizeMB(path.join(RESOURCES, 'server')).toFixed(1)} MiB) + web (${dirSizeMB(path.join(RESOURCES, 'web')).toFixed(1)} MiB)`,
);
log(`  total del runtime: ${(dirSizeMB(BINARIES) + dirSizeMB(RESOURCES)).toFixed(1)} MiB`);
