import path from 'node:path';
import os from 'node:os';

/**
 * Configuración del servidor SaleManteiner.
 *
 * La BD vive en `~/.salemanteiner/` por defecto para no perder datos si
 * el usuario mueve o borra la carpeta del proyecto.
 */
const HOME = os.homedir();
export const SALEMANTEINER_DIR = process.env.SALEMANTEINER_DIR
  ? path.resolve(process.env.SALEMANTEINER_DIR)
  : path.join(HOME, '.salemanteiner');

export const DB_PATH = process.env.SALEMANTEINER_DB ?? path.join(SALEMANTEINER_DIR, 'data.db');
export const PORT = Number(process.env.PORT ?? 4000);
export const HOST = process.env.HOST ?? '127.0.0.1';
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';