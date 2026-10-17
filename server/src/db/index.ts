import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Abre una conexión a SQLite y aplica pragmas sensatos.
 * En producción se llama una vez al arrancar; en tests se llama por test con `:memory:`.
 *
 * Si `path` apunta a un archivo en un directorio que aún no existe, lo crea
 * (recursivo). `better-sqlite3` no crea el directorio padre y tira
 * `TypeError: Cannot open database because the directory does not exist`
 * en Windows/Linux si la ruta no existe. Con esto, basta con pasar
 * `SALEMANTEINER_DIR` apuntando a un path cualquiera y el server arranca.
 *
 * `:memory:` se maneja por better-sqlite3 sin tocar el filesystem;
 * `dirname(':memory:')` devuelve `'.'`, y `mkdirSync('.', { recursive: true })`
 * es un no-op.
 */
export function openDb(path: string): DatabaseType {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  // WAL mejora concurrencia lector/escritor (aunque en este MVP no hay concurrencia real).
  db.pragma('journal_mode = WAL');
  // Activa FK por si en migraciones futuras hay relaciones entre tablas.
  db.pragma('foreign_keys = ON');
  return db;
}
