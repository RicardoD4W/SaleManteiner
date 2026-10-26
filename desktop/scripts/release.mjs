import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DESKTOP = path.resolve(HERE, '..');
export const RELEASE_DIR = path.join(DESKTOP, 'target', 'release', 'bundle', 'nsis');
export const REPO = 'RicardoD4W/SaleManteiner';
export const ENDPOINT = `https://github.com/${REPO}/releases/latest/download/latest.json`;

export function installerName(version) {
  return `SaleManteiner_${version}_x64-setup.exe`;
}

export function readLocalVersion() {
  const conf = JSON.parse(readFileSync(path.join(DESKTOP, 'tauri.conf.json'), 'utf8'));
  return conf.version;
}

export function buildLatestJson(version, signatureFile) {
  return {
    version,
    notes: `SaleManteiner ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: readFileSync(signatureFile, 'utf8').trim(),
        url: `https://github.com/${REPO}/releases/download/v${version}/${installerName(version)}`,
      },
    },
  };
}

function log(msg) {
  console.log(`[release] ${msg}`);
}

function fail(msg) {
  console.error(`[release] ERROR: ${msg}`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let conf;
  try {
    conf = JSON.parse(readFileSync(path.join(DESKTOP, 'tauri.conf.json'), 'utf8'));
  } catch (err) {
    fail(`no puedo leer tauri.conf.json: ${err.message}`);
  }
  const version = conf.version;

  const installer = path.join(RELEASE_DIR, installerName(version));
  const signatureFile = `${installer}.sig`;
  if (!existsSync(installer)) fail(`no encuentro el instalador en ${installer}`);
  if (!existsSync(signatureFile)) {
    fail(
      `no encuentro la firma ${signatureFile} → el build tiene que correr con TAURI_SIGNING_PRIVATE_KEY`,
    );
  }

  const latest = buildLatestJson(version, signatureFile);
  const latestPath = path.join(RELEASE_DIR, 'latest.json');
  writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`);
  log(`latest.json escrito en ${latestPath}`);
  log('');
  log('Para publicar (con gh o a mano):');
  log(`  1. crear la release v${version} en ${REPO}`);
  log(`  2. subir SaleManteiner_${version}_x64-setup.exe y su .sig`);
  log(`  3. subir latest.json (el updater lo busca en releases/latest/download/latest.json)`);
  log('');
  log('La app del cliente se actualiza sola: consulta el endpoint, verifica la firma');
  log('minisign con la clave pública de tauri.conf.json y baja el instalador.');
}
