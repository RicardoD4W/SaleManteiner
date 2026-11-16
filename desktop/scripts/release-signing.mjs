import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PUBLIC_KEY_BLOB_BYTES = 42;
const SIGNATURE_BLOB_BYTES = 74;
const GLOBAL_SIGNATURE_BYTES = 64;
const TRUSTED_COMMENT_PREFIX = 'trusted comment: ';

export function decodeBase64Strict(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  const buffer = Buffer.from(text, 'base64');
  const normalized = buffer.toString('base64').replace(/=+$/, '');
  if (normalized !== text.replace(/=+$/, '')) return null;
  return buffer;
}

const PUBLIC_KEY_MARKER = 'minisign public key';

export function readPublicKeyFile(pubkey) {
  const text = String(pubkey ?? '').trim();
  if (!text) return null;
  if (text.includes(PUBLIC_KEY_MARKER)) return Buffer.from(text, 'utf8');
  const decoded = decodeBase64Strict(text);
  if (decoded && decoded.toString('utf8').includes(PUBLIC_KEY_MARKER)) return decoded;
  return null;
}

export function decodePublicKey(pubkey) {
  const file = readPublicKeyFile(pubkey);
  if (!file) {
    return { ok: false, reason: 'la clave pública no está en formato minisign' };
  }

  const lines = file
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) return { ok: false, reason: 'el archivo de clave pública está vacío' };

  const blob = decodeBase64Strict(lines.at(-1));
  if (!blob || blob.length !== PUBLIC_KEY_BLOB_BYTES) {
    return { ok: false, reason: 'el archivo de clave pública no tiene el formato minisign' };
  }

  const keyId = blob.subarray(2, 10).toString('hex');
  const comment = /minisign public key:\s*([0-9A-Fa-f]+)/.exec(lines[0]);
  let expectedCommentKeyId = '';
  for (let index = 9; index >= 2; index -= 1) {
    expectedCommentKeyId += blob[index].toString(16).padStart(2, '0');
  }
  if (comment && comment[1].toLowerCase() !== expectedCommentKeyId) {
    return {
      ok: false,
      reason: `el comentario dice ${comment[1].toLowerCase()} y la clave es ${expectedCommentKeyId}`,
    };
  }

  return {
    ok: true,
    keyId,
    publicKey: blob.subarray(10),
    publicKeyFile: file,
    keyObject: createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, blob.subarray(10)]),
      format: 'der',
      type: 'spki',
    }),
  };
}

export function decodeSignatureFile(signatureBase64) {
  const file = decodeBase64Strict(signatureBase64);
  if (!file) return { ok: false, reason: 'la firma no es base64 válido' };

  const sections = file.toString('utf8').split('\n');
  if (sections.length < 4) {
    return { ok: false, reason: 'la firma no tiene las cuatro secciones de minisign' };
  }
  if (!sections[0].startsWith('untrusted comment: ')) {
    return { ok: false, reason: 'la firma no empieza por el comentario de minisign' };
  }

  const blob = decodeBase64Strict(sections[1]);
  if (!blob || blob.length !== SIGNATURE_BLOB_BYTES) {
    return { ok: false, reason: 'la sección de la firma no tiene los 74 bytes esperados' };
  }
  const algorithm = blob.subarray(0, 2).toString('latin1');
  if (algorithm !== 'ED') {
    return { ok: false, reason: `la firma usa el algoritmo ${algorithm} y solo se admite ED` };
  }

  const trustedCommentLine = sections[2] ?? '';
  if (!trustedCommentLine.startsWith(TRUSTED_COMMENT_PREFIX)) {
    return { ok: false, reason: 'la firma no tiene el comentario confiable' };
  }
  const trustedComment = trustedCommentLine.slice(TRUSTED_COMMENT_PREFIX.length).trim();

  const globalSignature = decodeBase64Strict(sections[3] ?? '');
  if (!globalSignature || globalSignature.length !== GLOBAL_SIGNATURE_BYTES) {
    return { ok: false, reason: 'la firma global no tiene los 64 bytes esperados' };
  }

  return {
    ok: true,
    keyId: blob.subarray(2, 10).toString('hex'),
    signature: blob.subarray(10),
    trustedComment,
    globalSignature,
  };
}

export function verifyArtifactSignature({ data, signatureBase64, pubkeyBase64 }) {
  const publicKey = decodePublicKey(pubkeyBase64);
  if (!publicKey.ok) return publicKey;

  const signature = decodeSignatureFile(signatureBase64);
  if (!signature.ok) return signature;

  if (signature.keyId !== publicKey.keyId) {
    return {
      ok: false,
      reason: `la firma es de la clave ${signature.keyId} y la clave pública es ${publicKey.keyId}`,
    };
  }

  const prehash = createHash('blake2b512').update(data).digest();
  if (!verifyEd25519(null, prehash, publicKey.keyObject, signature.signature)) {
    return { ok: false, reason: 'la firma no valida contra el hash del artefacto' };
  }

  const globalMessage = Buffer.concat([
    signature.signature,
    Buffer.from(signature.trustedComment, 'utf8'),
  ]);
  if (!verifyEd25519(null, globalMessage, publicKey.keyObject, signature.globalSignature)) {
    return { ok: false, reason: 'la firma global no valida contra el comentario confiable' };
  }

  return { ok: true, keyId: publicKey.keyId };
}

export function verifyArtifactFile({ filePath, signaturePath, pubkeyBase64 }) {
  return verifyArtifactSignature({
    data: readFileSync(filePath),
    signatureBase64: readFileSync(signaturePath, 'utf8'),
    pubkeyBase64,
  });
}
