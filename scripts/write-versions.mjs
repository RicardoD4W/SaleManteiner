import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function log(msg) {
  console.log(`[versions] ${msg}`);
}

const app = readJson(path.join(REPO, 'desktop', 'tauri.conf.json')).version;
const front = readJson(path.join(REPO, 'web', 'package.json')).version;
const back = readJson(path.join(REPO, 'server', 'package.json')).version;

const envPath = path.join(REPO, 'web', '.env');
const envContent = [
  '# Generado por scripts/write-versions.mjs. No editar a mano.',
  `VITE_APP_VERSION=${app}`,
  `VITE_FRONT_VERSION=${front}`,
  `VITE_BACK_VERSION=${back}`,
  '',
].join('\n');
writeFileSync(envPath, envContent);
log(`web/.env escrito (app ${app} · front ${front} · back ${back})`);

const manifest = { app, front, back };

const serverDir = path.join(REPO, 'server');
writeFileSync(path.join(serverDir, 'version.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log('server/version.json escrito');

const targetIndex = process.argv.indexOf('--target');
if (targetIndex !== -1 && process.argv[targetIndex + 1]) {
  const target = path.resolve(process.argv[targetIndex + 1]);
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'version.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`version.json escrito en ${target}`);
}
