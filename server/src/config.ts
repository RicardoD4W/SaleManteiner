import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SALEMANTEINER_DIR = process.env.SALEMANTEINER_DIR
  ? path.resolve(process.env.SALEMANTEINER_DIR)
  : path.join(HOME, '.salemanteiner');

export const DB_PATH = process.env.SALEMANTEINER_DB ?? path.join(SALEMANTEINER_DIR, 'data.db');
export const WEB_DIR =
  process.env.SALEMANTEINER_WEB_DIR ?? path.resolve(SERVER_DIR, '..', 'web', 'dist');
const parsedPort = Number(process.env.PORT ?? 4000);
export const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
export const HOST = process.env.HOST ?? '127.0.0.1';
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
