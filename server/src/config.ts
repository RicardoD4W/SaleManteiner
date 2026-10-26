import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { hasUserData } from './db/probe.js';
import { resolveDbPath } from './db/resolve-path.js';
import type { DbPathSource } from './db/resolve-path.js';

const HOME = os.homedir();
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const resolution = resolveDbPath({
  env: process.env,
  home: HOME,
  platform: process.platform,
  hasData: hasUserData,
});

export const DB_PATH = resolution.path;
export const DB_SOURCE: DbPathSource = resolution.source;
export const SALEMANTEINER_DIR = path.dirname(DB_PATH);
export const WEB_DIR =
  process.env.SALEMANTEINER_WEB_DIR ?? path.resolve(SERVER_DIR, '..', 'web', 'dist');
const parsedPort = Number(process.env.PORT ?? 4000);
export const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
export const HOST = process.env.HOST ?? '127.0.0.1';
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
