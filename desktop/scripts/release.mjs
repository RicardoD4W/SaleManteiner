import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '..');
const RELEASE_DIR = path.join(DESKTOP, 'target', 'release', 'bundle', 'nsis');

const REPO = 'RicardoD4W/SaleManteiner';

function log(msg) {
  console.log(`[release] ${msg}`);
}

function fail(msg) {
  console.error(`[release] ERROR: ${msg}`);
  process.exit(1);
}

let conf;
try {
  conf = JSON.parse(readFileSync(path.join(DESKTOP, 'tauri.conf.json'), 'utf8'));
} catch (err) {
  fail(`no puedo leer tauri.conf.json: ${err.message}`);
}
const version = conf.version;

const installer = path.join(RELEASE_DIR, `SaleManteiner_${version}_x64-setup.exe`);
const signatureFile = `${installer}.sig`;
if (!existsSync(installer)) fail(`no encuentro el instalador en ${installer}`);
if (!existsSync(signatureFile)) {
  fail(
    `no encuentro la firma ${signatureFile} → el build tiene que correr con TAURI_SIGNING_PRIVATE_KEY`,
  );
}

const latest = {
  version,
  notes: `SaleManteiner ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(signatureFile, 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/SaleManteiner_${version}_x64-setup.exe`,
    },
  },
};

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
