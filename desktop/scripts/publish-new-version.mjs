import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DESKTOP,
  ENDPOINT,
  REPO,
  RELEASE_DIR,
  buildInstallerZip,
  buildLatestJson,
  installerName,
  installerZipName,
  readLocalVersion,
} from './release.mjs';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}

const TOKEN_KEY = 'GH_TOKEN';

function log(msg) {
  console.log(`[publish] ${msg}`);
}

function fail(msg) {
  console.error(`[publish] ERROR: ${msg}`);
  process.exit(1);
}

function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function decidePublish(localVersion, distributedVersion) {
  const local = parseSemver(localVersion);
  if (!local) throw new Error(`la versión local "${localVersion}" no es un semver válido`);
  if (distributedVersion === null || distributedVersion === undefined) return 'publish';
  const remote = parseSemver(distributedVersion);
  if (!remote) {
    throw new Error(`la versión distribuida "${distributedVersion}" no es un semver válido`);
  }
  const order = compareSemver(local, remote);
  if (order === 0) return 'up-to-date';
  return order < 0 ? 'downgrade' : 'publish';
}

async function fetchDistributed() {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      headers: { 'user-agent': 'salemanteiner-publish' },
      redirect: 'follow',
    });
  } catch (error) {
    fail(`no pude consultar la versión distribuida en ${ENDPOINT}: ${error.message}`);
  }
  if (response.status === 404) return { version: null, published: false };
  if (!response.ok) {
    fail(`el endpoint respondió HTTP ${response.status} (${ENDPOINT})`);
  }
  const body = await response.json();
  return { version: body.version ?? null, published: true };
}

function git(...args) {
  return execFileSync('git', args, { cwd: DESKTOP, encoding: 'utf8' }).trim();
}

async function main() {
  const localVersion = readLocalVersion();
  const distributed = await fetchDistributed();
  log(`versión local:       ${localVersion}`);
  log(`versión distribuida: ${distributed.version ?? '(no hay ninguna release publicada)'}`);

  const decision = decidePublish(localVersion, distributed.version);
  if (decision === 'up-to-date') {
    log('la versión local ya es la que está distribuida: no hay nada que publicar');
    return;
  }
  if (decision === 'downgrade') {
    fail(
      `la versión local (${localVersion}) es MENOR que la distribuida (${distributed.version}): ` +
        'publicar sería un downgrade y el updater lo ignoraría. Subí la versión en desktop/tauri.conf.json',
    );
  }

  const installer = path.join(RELEASE_DIR, installerName(localVersion));
  const signatureFile = `${installer}.sig`;
  const latestPath = path.join(RELEASE_DIR, 'latest.json');
  if (!existsSync(installer)) {
    fail(
      `falta el instalador firmado: ${installer}\n` +
        '  corré `npm run build:app` con TAURI_SIGNING_PRIVATE_KEY_PATH y TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    );
  }
  if (!existsSync(signatureFile)) {
    fail(
      `falta la firma: ${signatureFile}\n` +
        '  el build tiene que firmarse (TAURI_SIGNING_PRIVATE_KEY_PATH + TAURI_SIGNING_PRIVATE_KEY_PASSWORD)',
    );
  }

  const token = process.env[TOKEN_KEY]?.trim();
  if (!token) {
    fail(
      `falta el token de GitHub: ponelo en desktop/.env como ${TOKEN_KEY}=... ` +
        `(o exportá ${TOKEN_KEY}). Hace falta un token con permiso "contents:write" ` +
        'para crear la release y subir los archivos',
    );
  }
  log(`token de GitHub: ${TOKEN_KEY}`);

  if (git('status', '--porcelain')) {
    fail(
      'el árbol de trabajo tiene cambios sin commitear: la versión que se publica tiene que estar commiteada',
    );
  }
  const head = git('rev-parse', 'HEAD');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const remoteSha = git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s+/)[0];
  if (remoteSha && remoteSha !== head) {
    fail(`el commit ${head.slice(0, 7)} no está en origin/${branch}: pusheá antes de publicar`);
  }

  const api = `https://api.github.com/repos/${REPO}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'salemanteiner-publish',
  };
  const tag = `v${localVersion}`;

  const tagResponse = await fetch(`${api}/git/ref/tags/${encodeURIComponent(tag)}`, { headers });
  if (tagResponse.status === 200) {
    fail(
      `el tag ${tag} ya existe: si la release quedó a medias, borrala (y el tag) en GitHub y volvé a correrlo`,
    );
  }
  if (tagResponse.status !== 404) {
    fail(`no pude consultar el tag ${tag}: HTTP ${tagResponse.status}`);
  }

  writeFileSync(
    latestPath,
    `${JSON.stringify(buildLatestJson(localVersion, signatureFile), null, 2)}\n`,
  );
  log(`latest.json armado en ${latestPath}`);

  const installerZip = buildInstallerZip(
    installer,
    path.join(RELEASE_DIR, installerZipName(localVersion)),
  );
  log(`instalador comprimido en ${installerZip} (para el cliente: sin aviso de SmartScreen)`);

  const releaseResponse = await fetch(`${api}/releases`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: head,
      name: `SaleManteiner ${localVersion}`,
      body: `SaleManteiner ${localVersion}`,
      draft: false,
      prerelease: false,
    }),
  });
  if (!releaseResponse.ok) {
    fail(
      `no pude crear la release: HTTP ${releaseResponse.status} ${await releaseResponse.text()}`,
    );
  }
  const release = await releaseResponse.json();
  log(`release creada: ${release.html_url}`);

  async function uploadAsset(releaseId, filePath, contentType) {
    const name = path.basename(filePath);
    const response = await fetch(
      `https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': contentType },
        body: readFileSync(filePath),
      },
    );
    if (!response.ok) {
      fail(`no pude subir ${name}: HTTP ${response.status} ${await response.text()}`);
    }
    log(`subido: ${name}`);
  }

  await uploadAsset(release.id, installer, 'application/octet-stream');
  await uploadAsset(release.id, installerZip, 'application/zip');
  await uploadAsset(release.id, signatureFile, 'text/plain');
  await uploadAsset(release.id, latestPath, 'application/json');

  log('');
  log(`publicada la versión ${localVersion} (${tag})`);
  log(`el updater la va a ver en: ${ENDPOINT}`);
  log('la app del cliente la detecta al abrir, verifica la firma minisign y se actualiza sola');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
