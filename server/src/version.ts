import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface AppVersions {
  app: string;
  front: string;
  back: string;
}

const require = createRequire(import.meta.url);
const { version: BACK } = require('../package.json') as { version: string };

const MANIFEST_PATH = fileURLToPath(new URL('../version.json', import.meta.url));

let manifest: Partial<AppVersions> | undefined;

function readManifest(): Partial<AppVersions> {
  if (manifest !== undefined) return manifest;
  if (!existsSync(MANIFEST_PATH)) {
    manifest = {};
    return manifest;
  }
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Partial<AppVersions>;
  } catch {
    manifest = {};
  }
  return manifest;
}

export function appVersions(): AppVersions {
  const versions = readManifest();
  return {
    app: process.env.SALE_MANTEINER_APP_VERSION ?? versions.app ?? 'dev',
    front: versions.front ?? 'dev',
    back: versions.back ?? BACK,
  };
}
