import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyArtifactFile } from './release-signing.mjs';
import { readUpdaterPubkey } from './release.mjs';

function fail(msg) {
  console.error(`[verify] ERROR: ${msg}`);
  process.exit(1);
}

function requireFile(filePath, what) {
  if (!existsSync(filePath)) {
    fail(`no encuentro ${what} en ${filePath} (las rutas son relativas a ${process.cwd()})`);
  }
  return filePath;
}

const [artifactPath, signaturePath, pubkeyPath] = process.argv.slice(2);
if (!artifactPath || !signaturePath) {
  fail('uso: node scripts/verify-release.mjs <artefacto> <firma> [clave publica]');
}

requireFile(artifactPath, 'el artefacto');
requireFile(signaturePath, 'la firma');
if (pubkeyPath) requireFile(pubkeyPath, 'la clave pública');

const pubkeyBase64 = pubkeyPath ? readFileSync(pubkeyPath, 'utf8') : readUpdaterPubkey();
const result = verifyArtifactFile({ filePath: artifactPath, signaturePath, pubkeyBase64 });

if (!result.ok) {
  fail(`la firma de ${path.basename(artifactPath)} no valida: ${result.reason}`);
}

console.log(
  `[verify] ${path.basename(artifactPath)} está firmado con la clave ${result.keyId} ` +
    `y la firma valida contra la clave pública`,
);
