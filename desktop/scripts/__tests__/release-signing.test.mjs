import { createHash, generateKeyPairSync, sign as signEd25519 } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  decodePublicKey,
  decodeSignatureFile,
  verifyArtifactFile,
  verifyArtifactSignature,
} from '../release-signing.mjs';
import { readUpdaterPubkey } from '../release.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');

function buildTauriStyleSignature(data) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  const keynum = createHash('sha256').update(rawPublicKey).digest().subarray(0, 8);

  const prehash = createHash('blake2b512').update(data).digest();
  const signature = signEd25519(null, prehash, privateKey);
  const trustedComment = 'timestamp:1794860679\tfile:artefacto.zip\tversion:1.0.0';
  const globalSignature = signEd25519(
    null,
    Buffer.concat([signature, Buffer.from(trustedComment, 'utf8')]),
    privateKey,
  );

  const signatureBlob = Buffer.concat([Buffer.from('ED', 'latin1'), keynum, signature]);
  const text = [
    'untrusted comment: signature from tauri secret key',
    signatureBlob.toString('base64'),
    `trusted comment: ${trustedComment}`,
    globalSignature.toString('base64'),
    '',
  ].join('\n');

  let displayKeyId = '';
  for (let index = keynum.length - 1; index >= 0; index -= 1) {
    displayKeyId += keynum[index].toString(16).padStart(2, '0');
  }
  const publicKeyBlob = Buffer.concat([Buffer.from('Ed', 'latin1'), keynum, rawPublicKey]);
  const publicKeyText = `untrusted comment: minisign public key: ${displayKeyId.toUpperCase()}\n${publicKeyBlob.toString('base64')}\n`;

  return {
    signatureBase64: Buffer.from(text, 'utf8').toString('base64'),
    pubkey: publicKeyText,
    keyId: keynum.toString('hex'),
  };
}

describe('decodePublicKey', () => {
  it('lee la clave pública real del updater del repo', () => {
    const decoded = decodePublicKey(readUpdaterPubkey());
    expect(decoded.ok).toBe(true);
    expect(decoded.keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(decoded.publicKey).toHaveLength(32);
    expect(decoded.publicKeyFile.toString('utf8')).toContain('minisign public key');
  });

  it('lee la clave pública tanto en base64 como en texto plano', () => {
    const encoded = decodePublicKey(readUpdaterPubkey());
    const plain = decodePublicKey(encoded.publicKeyFile.toString('utf8'));
    expect(plain.ok).toBe(true);
    expect(plain.keyId).toBe(encoded.keyId);
  });

  it('rechaza una clave pública que no está en formato minisign', () => {
    expect(decodePublicKey('no es base64').ok).toBe(false);
  });

  it('rechaza una clave pública con el formato equivocado', () => {
    const decoded = decodePublicKey(
      Buffer.from('untrusted comment: x\nabc\n').toString('base64'),
    );
    expect(decoded.ok).toBe(false);
  });
});

describe('decodeSignatureFile', () => {
  it('rechaza una firma que no son las cuatro secciones de minisign', () => {
    const decoded = decodeSignatureFile(Buffer.from('corto').toString('base64'));
    expect(decoded.ok).toBe(false);
  });

  it('rechaza una firma con el algoritmo legacy', () => {
    const data = Buffer.from('contenido');
    const fixture = buildTauriStyleSignature(data);
    const text = Buffer.from(fixture.signatureBase64, 'base64').toString('utf8');
    const sections = text.split('\n');
    const blob = Buffer.from(sections[1], 'base64');
    const legacy = Buffer.concat([Buffer.from('Ed', 'latin1'), blob.subarray(2)]);
    const legacyText = [
      sections[0],
      legacy.toString('base64'),
      sections[2],
      sections[3],
      '',
    ].join('\n');
    const decoded = decodeSignatureFile(Buffer.from(legacyText, 'utf8').toString('base64'));
    expect(decoded.ok).toBe(false);
    expect(decoded.reason).toContain('ED');
  });
});

describe('verifyArtifactSignature', () => {
  it('valida una firma hecha sobre el artefacto', () => {
    const data = Buffer.from('contenido del instalador');
    const fixture = buildTauriStyleSignature(data);
    const result = verifyArtifactSignature({
      data,
      signatureBase64: fixture.signatureBase64,
      pubkeyBase64: fixture.pubkey,
    });
    expect(result.ok).toBe(true);
    expect(result.keyId).toBe(fixture.keyId);
  });

  it('rechaza el artefacto si alguien lo cambia', () => {
    const data = Buffer.from('contenido del instalador');
    const fixture = buildTauriStyleSignature(data);
    const result = verifyArtifactSignature({
      data: Buffer.from('contenido del instalador, pero cambiado'),
      signatureBase64: fixture.signatureBase64,
      pubkeyBase64: fixture.pubkey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no valida');
  });

  it('rechaza una firma hecha con otra clave', () => {
    const data = Buffer.from('contenido del instalador');
    const fixture = buildTauriStyleSignature(data);
    const other = buildTauriStyleSignature(data);
    const result = verifyArtifactSignature({
      data,
      signatureBase64: other.signatureBase64,
      pubkeyBase64: fixture.pubkey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('la firma es de la clave');
  });
});

describe('una firma hecha de verdad por la CLI de Tauri', () => {
  it('valida contra la clave pública con la que se firmó', () => {
    const result = verifyArtifactFile({
      filePath: path.join(FIXTURES, 'artefacto-de-prueba.zip'),
      signaturePath: path.join(FIXTURES, 'artefacto-de-prueba.zip.sig'),
      pubkeyBase64: readFileSync(path.join(FIXTURES, 'clave-publica.pub'), 'utf8'),
    });
    expect(result.ok).toBe(true);
  });

  it('no valida contra la clave pública del updater del repo, que es otra', () => {
    const result = verifyArtifactFile({
      filePath: path.join(FIXTURES, 'artefacto-de-prueba.zip'),
      signaturePath: path.join(FIXTURES, 'artefacto-de-prueba.zip.sig'),
      pubkeyBase64: readUpdaterPubkey(),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('la firma es de la clave');
  });
});
