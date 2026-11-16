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
import {
  buildRuntimeArtifacts,
  diffRuntimeDependencies,
  diffRuntimeLockfiles,
  sha256File,
  verifyNodeRuntime,
} from './runtime-lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '..');
const REPO = path.resolve(DESKTOP, '..');

const BINARIES = path.join(DESKTOP, 'binaries');
const RESOURCES = path.join(DESKTOP, 'resources');
const RUNTIME_DIR = path.join(DESKTOP, 'runtime');

const TARGET = 'x86_64-pc-windows-msvc';
const SIDECAR = `salemanteiner-server-${TARGET}.exe`;

const NODE_PIN_PATH = path.join(RUNTIME_DIR, 'node-runtime.json');
const RUNTIME_PACKAGE_PATH = path.join(RUNTIME_DIR, 'package.json');
const RUNTIME_LOCK_PATH = path.join(RUNTIME_DIR, 'package-lock.json');
const ROOT_LOCK_PATH = path.join(REPO, 'package-lock.json');
const SERVER_PACKAGE_PATH = path.join(REPO, 'server', 'package.json');

function log(msg) {
  console.log(`[pack] ${msg}`);
}

function fail(msg) {
  console.error(`[pack] ERROR: ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`no puedo leer ${filePath}: ${err.message}`);
  }
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

log('verificando el runtime de node');
const nodePin = readJson(NODE_PIN_PATH);
const nodeSha256 = sha256File(process.execPath);
const nodeCheck = verifyNodeRuntime(nodePin.runtimes, process.version, nodeSha256);
if (!nodeCheck.ok) {
  fail(
    `${nodeCheck.reason}\n` +
      `  instalá una de las versiones verificadas ` +
      `(${(nodePin.runtimes ?? []).map((runtime) => runtime.version).join(', ')}) y volvé a empaquetar`,
  );
}
log(`  node ${nodeCheck.runtime.version} verificado (sha256 ${nodeSha256})`);

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

const runtimeDir = path.join(RESOURCES, 'server');
const serverPackage = readJson(SERVER_PACKAGE_PATH);
const runtimePackage = readJson(RUNTIME_PACKAGE_PATH);
const rootLock = readJson(ROOT_LOCK_PATH);
const committedLock = readJson(RUNTIME_LOCK_PATH);

const drift = diffRuntimeDependencies(
  serverPackage.dependencies ?? {},
  runtimePackage.dependencies ?? {},
);
const driftLines = [
  ...drift.missing.map((name) => `falta ${name}`),
  ...drift.extra.map((name) => `sobra ${name}`),
  ...drift.unpinned.map((name) => `${name} no está pineada`),
  ...drift.incompatible.map((problem) => problem),
];
if (driftLines.length) {
  fail(
    'las dependencias de runtime no están sincronizadas con server/package.json:\n' +
      `${driftLines.map((line) => `  ${line}`).join('\n')}\n` +
      '  corré `npm run sync:runtime` en desktop/',
  );
}

const expected = buildRuntimeArtifacts({
  rootLock,
  workspacePath: 'server',
  runtimeName: runtimePackage.name,
  runtimeVersion: runtimePackage.version,
  serverDependencies: serverPackage.dependencies ?? {},
});
const lockProblems = diffRuntimeLockfiles(expected.lockfile, committedLock);
if (lockProblems.length) {
  fail(
    'el lockfile del runtime no coincide con el lockfile raíz:\n' +
      `${lockProblems.map((problem) => `  ${problem}`).join('\n')}\n` +
      '  corré `npm run sync:runtime` en desktop/',
  );
}

writeFileSync(
  path.join(runtimeDir, 'package.json'),
  readFileSync(RUNTIME_PACKAGE_PATH, 'utf8'),
);
writeFileSync(
  path.join(runtimeDir, 'package-lock.json'),
  readFileSync(RUNTIME_LOCK_PATH, 'utf8'),
);
log('  instalando las dependencias de runtime (npm ci, solo prod)');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  execFileSync(
    npmCmd,
    ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'],
    { cwd: runtimeDir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
} catch (err) {
  fail(`falló el npm ci de las dependencias de runtime: ${err.message}`);
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

const runtimeManifest = {
  node: {
    version: nodeCheck.runtime.version,
    sha256: nodeSha256,
    source: nodeCheck.runtime.source ?? null,
  },
  dependencies: Object.fromEntries(
    Object.entries(committedLock.packages)
      .filter(([name]) => name.startsWith('node_modules/'))
      .map(([name, entry]) => [name.slice('node_modules/'.length), entry.version])
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
};
writeFileSync(
  path.join(runtimeDir, 'runtime-manifest.json'),
  `${JSON.stringify(runtimeManifest, null, 2)}\n`,
);
log('  runtime-manifest.json ✓');

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
