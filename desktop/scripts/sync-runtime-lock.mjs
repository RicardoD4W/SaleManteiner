import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRuntimeArtifacts } from './runtime-lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '..');
const REPO = path.resolve(DESKTOP, '..');
const RUNTIME_DIR = path.join(DESKTOP, 'runtime');

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[runtime] ERROR: no puedo leer ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

const rootLock = readJson(path.join(REPO, 'package-lock.json'));
const serverPkg = readJson(path.join(REPO, 'server', 'package.json'));
const currentRuntime = readJson(path.join(RUNTIME_DIR, 'package.json'));

let artifacts;
try {
  artifacts = buildRuntimeArtifacts({
    rootLock,
    workspacePath: 'server',
    runtimeName: currentRuntime.name,
    runtimeVersion: currentRuntime.version,
    serverDependencies: serverPkg.dependencies ?? {},
  });
} catch (err) {
  console.error(`[runtime] ERROR: ${err.message}`);
  process.exit(1);
}

writeFileSync(
  path.join(RUNTIME_DIR, 'package.json'),
  `${JSON.stringify(artifacts.packageJson, null, 2)}\n`,
);
writeFileSync(
  path.join(RUNTIME_DIR, 'package-lock.json'),
  `${JSON.stringify(artifacts.lockfile, null, 2)}\n`,
);

const packages = Object.keys(artifacts.lockfile.packages).length - 1;
console.log(
  `[runtime] lockfile regenerado desde el lockfile raíz: ${packages} paquetes pineados ` +
    `(${Object.keys(artifacts.packageJson.dependencies).join(', ')})`,
);
