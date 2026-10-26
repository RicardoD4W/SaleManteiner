import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

const DATA_TABLE_QUERIES: Record<string, string> = {
  buys: 'SELECT 1 FROM "buys" LIMIT 1',
  solds: 'SELECT 1 FROM "solds" LIMIT 1',
  customers: 'SELECT 1 FROM "customers" LIMIT 1',
  sale_items: 'SELECT 1 FROM "sale_items" LIMIT 1',
};

export function hasUserData(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  let connection: DatabaseType | undefined;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    connection = db;
    const tables = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
          name: string;
        }>
      ).map((row) => row.name),
    );
    return Object.entries(DATA_TABLE_QUERIES).some(
      ([table, query]) => tables.has(table) && db.prepare(query).get() !== undefined,
    );
  } catch {
    return false;
  } finally {
    connection?.close();
  }
}
