import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../db/migrate.js';

export interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

export interface RestoreSummary {
  customers: number;
  buys: number;
  solds: number;
  sale_items: number;
  expenses: number;
  expense_categories: number;
  safety_backup: string;
}

export interface BackupService {
  list(): BackupFile[];
  create(): BackupFile;
  remove(name: string): void;
  restoreFromBuffer(buffer: Buffer, originalName: string): RestoreSummary;
  restoreFromStored(name: string): RestoreSummary;
  backupsDir(): string;
  pathOf(name: string): string;
  exists(name: string): boolean;
}

export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export class BackupNotFoundError extends Error {
  constructor(name: string) {
    super(`La copia "${name}" no existe`);
    this.name = 'BackupNotFoundError';
  }
}

const REQUIRED_TABLES = ['customers', 'buys', 'solds', 'sale_items'];
const SAFE_NAME_RE = /^[A-Za-z0-9._-]+$/;
const COLLECTED_AMOUNT_SCHEMA_VERSION = 6;
const DEBT_DEFAULT_SCHEMA_VERSION = 8;

const DELETE_SALE_ITEMS = 'DELETE FROM sale_items';
const DELETE_SOLDS = 'DELETE FROM solds';
const DELETE_BUYS = 'DELETE FROM buys';
const DELETE_EXPENSES = 'DELETE FROM expenses';
const DELETE_EXPENSE_CATEGORIES = 'DELETE FROM expense_categories';
const DELETE_CUSTOMERS = 'DELETE FROM customers';

const INSERT_CUSTOMERS = `INSERT INTO customers (id, name, phone, address, notes, created_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.phone'),
         json_extract(value, '$.address'), json_extract(value, '$.notes'), json_extract(value, '$.created_at')
  FROM json_each(?)`;
const INSERT_BUYS = `INSERT INTO buys (id, product_name, purchase_cost, quantity, associated_costs, purchase_date, notes, created_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.product_name'), json_extract(value, '$.purchase_cost'),
         json_extract(value, '$.quantity'), json_extract(value, '$.associated_costs'), json_extract(value, '$.purchase_date'),
         json_extract(value, '$.notes'), json_extract(value, '$.created_at')
  FROM json_each(?)`;
const INSERT_SOLDS = `INSERT INTO solds (id, customer_id, sale_price, associated_costs, paid_amount, sold_at, notes, created_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.customer_id'), json_extract(value, '$.sale_price'),
         json_extract(value, '$.associated_costs'), json_extract(value, '$.paid_amount'), json_extract(value, '$.sold_at'),
         json_extract(value, '$.notes'), json_extract(value, '$.created_at')
  FROM json_each(?)`;
const INSERT_SALE_ITEMS = `INSERT INTO sale_items (sold_id, buy_id, quantity)
  SELECT json_extract(value, '$.sold_id'), json_extract(value, '$.buy_id'), json_extract(value, '$.quantity')
  FROM json_each(?)`;
const INSERT_EXPENSE_CATEGORIES = `INSERT INTO expense_categories (id, name, created_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.created_at')
  FROM json_each(?)`;
const INSERT_EXPENSES = `INSERT INTO expenses (id, concept, amount, category_id, expense_date, created_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.concept'), json_extract(value, '$.amount'),
         json_extract(value, '$.category_id'), json_extract(value, '$.expense_date'), json_extract(value, '$.created_at')
  FROM json_each(?)`;

const SELECT_CUSTOMERS_CURRENT =
  "SELECT json_object('id', id, 'name', name, 'phone', phone, 'address', address, 'notes', notes, 'created_at', created_at) AS row FROM customers";
const SELECT_CUSTOMERS_LEGACY =
  "SELECT json_object('id', id, 'name', name, 'created_at', created_at) AS row FROM customers";
const SELECT_BUYS_CURRENT =
  "SELECT json_object('id', id, 'product_name', product_name, 'purchase_cost', purchase_cost, 'quantity', quantity, 'associated_costs', associated_costs, 'purchase_date', purchase_date, 'notes', notes, 'created_at', created_at) AS row FROM buys";
const SELECT_BUYS_LEGACY =
  "SELECT json_object('id', id, 'product_name', product_name, 'purchase_cost', purchase_cost, 'quantity', quantity, 'associated_costs', associated_costs, 'purchase_date', purchase_date, 'created_at', created_at) AS row FROM buys";
const SELECT_SOLDS_CURRENT =
  "SELECT json_object('id', id, 'customer_id', customer_id, 'sale_price', sale_price, 'associated_costs', associated_costs, 'paid_amount', paid_amount, 'sold_at', sold_at, 'notes', notes, 'created_at', created_at) AS row FROM solds";
const SELECT_SOLDS_OLD_DEBT =
  "SELECT json_object('id', id, 'customer_id', customer_id, 'sale_price', sale_price, 'associated_costs', associated_costs, 'paid_amount', CASE WHEN paid_amount IS NULL OR paid_amount = 0 THEN sale_price ELSE paid_amount END, 'sold_at', sold_at, 'notes', notes, 'created_at', created_at) AS row FROM solds";
const SELECT_SOLDS_WITHOUT_COLLECTED_AMOUNT =
  "SELECT json_object('id', id, 'customer_id', customer_id, 'sale_price', sale_price, 'associated_costs', associated_costs, 'paid_amount', sale_price, 'sold_at', sold_at, 'notes', notes, 'created_at', created_at) AS row FROM solds";
const SELECT_SOLDS_LEGACY =
  "SELECT json_object('id', id, 'customer_id', customer_id, 'sale_price', sale_price, 'associated_costs', associated_costs, 'sold_at', sold_at, 'notes', notes, 'created_at', created_at) AS row FROM solds";
const SELECT_SALE_ITEMS =
  "SELECT json_object('sold_id', sold_id, 'buy_id', buy_id, 'quantity', quantity) AS row FROM sale_items";
const SELECT_EXPENSE_CATEGORIES =
  "SELECT json_object('id', id, 'name', name, 'created_at', created_at) AS row FROM expense_categories";
const SELECT_EXPENSES =
  "SELECT json_object('id', id, 'concept', concept, 'amount', amount, 'category_id', category_id, 'expense_date', expense_date, 'created_at', created_at) AS row FROM expenses";

function timestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function tableExists(db: DatabaseType, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return row !== undefined;
}

function columnExists(db: DatabaseType, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function appliedSchemaVersion(backup: DatabaseType): number {
  if (!tableExists(backup, '_migrations')) return 0;
  const row = backup.prepare('SELECT MAX(version) AS version FROM _migrations').get() as
    { version: number | null } | undefined;
  return row?.version ?? 0;
}

function soldsSelect(backup: DatabaseType): string {
  const version = appliedSchemaVersion(backup);
  if (version >= DEBT_DEFAULT_SCHEMA_VERSION) return SELECT_SOLDS_CURRENT;
  if (version >= COLLECTED_AMOUNT_SCHEMA_VERSION) return SELECT_SOLDS_OLD_DEBT;
  if (columnExists(backup, 'solds', 'paid_amount')) return SELECT_SOLDS_OLD_DEBT;
  return SELECT_SOLDS_WITHOUT_COLLECTED_AMOUNT;
}

export function createBackupService(deps: {
  db: DatabaseType;
  dbPath: string;
  backupsDir?: string;
}): BackupService {
  const { db } = deps;
  const backupsDir = deps.backupsDir ?? join(deps.dbPath.replace(/[\\/][^\\/]*$/, ''), 'backups');

  function ensureDir(): void {
    if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });
  }

  function safeName(name: string): string {
    if (!SAFE_NAME_RE.test(name) || name.includes('..')) {
      throw new InvalidBackupError('El nombre de la copia no es válido');
    }
    return name;
  }

  function pathOf(name: string): string {
    return join(backupsDir, safeName(name));
  }

  function writeSnapshot(target: string): void {
    db.prepare('VACUUM INTO ?').run(target);
  }

  function uniquePath(prefix: string): string {
    const base = `${prefix}${timestamp()}`;
    let candidate = `${base}.db`;
    let counter = 1;
    while (existsSync(join(backupsDir, candidate))) {
      candidate = `${base}-${counter}.db`;
      counter += 1;
    }
    return join(backupsDir, candidate);
  }

  function describe(path: string, name: string): BackupFile {
    const stats = statSync(path);
    return { name, size: stats.size, created_at: stats.mtime.toISOString() };
  }

  function list(): BackupFile[] {
    if (!existsSync(backupsDir)) return [];
    return readdirSync(backupsDir)
      .filter((name) => name.endsWith('.db'))
      .map((name) => describe(join(backupsDir, name), name))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function create(): BackupFile {
    ensureDir();
    const target = uniquePath('salemanteiner-');
    writeSnapshot(target);
    return describe(target, target.split(/[\\/]/).pop() as string);
  }

  function remove(name: string): void {
    const path = pathOf(name);
    if (!existsSync(path)) throw new BackupNotFoundError(name);
    unlinkSync(path);
  }

  function openBackup(path: string): DatabaseType {
    let backup: DatabaseType;
    try {
      backup = new Database(path, { readonly: true, fileMustExist: true });
    } catch {
      throw new InvalidBackupError('El archivo no es una base de datos válida');
    }
    try {
      const integrity = backup.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') {
        throw new InvalidBackupError('El archivo está dañado y no se puede restaurar');
      }
      for (const table of REQUIRED_TABLES) {
        if (!tableExists(backup, table)) {
          throw new InvalidBackupError('El archivo no contiene los datos de SaleManteiner');
        }
      }
    } catch (err) {
      backup.close();
      if (err instanceof InvalidBackupError) throw err;
      throw new InvalidBackupError('El archivo no es una base de datos válida');
    }
    return backup;
  }

  function readRows(backup: DatabaseType, current: string, legacy: string | null): string[] {
    try {
      return unwrap(backup.prepare(current).all());
    } catch (err) {
      if (!legacy) throw err;
      return unwrap(backup.prepare(legacy).all());
    }
  }

  function unwrap(rows: unknown[]): string[] {
    return (rows as Array<{ row: string }>).map((entry) => entry.row);
  }

  function importFrom(backup: DatabaseType): RestoreSummary {
    const customers = readRows(backup, SELECT_CUSTOMERS_CURRENT, SELECT_CUSTOMERS_LEGACY);
    const buys = readRows(backup, SELECT_BUYS_CURRENT, SELECT_BUYS_LEGACY);
    const solds = readRows(backup, soldsSelect(backup), SELECT_SOLDS_LEGACY);
    const saleItems = readRows(backup, SELECT_SALE_ITEMS, null);
    const categories = tableExists(backup, 'expense_categories')
      ? readRows(backup, SELECT_EXPENSE_CATEGORIES, null)
      : [];
    const expenses = tableExists(backup, 'expenses') ? readRows(backup, SELECT_EXPENSES, null) : [];

    const counts = {
      customers: customers.length,
      buys: buys.length,
      solds: solds.length,
      sale_items: saleItems.length,
      expense_categories: categories.length,
      expenses: expenses.length,
    };

    const importAll = db.transaction(() => {
      db.prepare(DELETE_SALE_ITEMS).run();
      db.prepare(DELETE_SOLDS).run();
      db.prepare(DELETE_BUYS).run();
      db.prepare(DELETE_EXPENSES).run();
      db.prepare(DELETE_EXPENSE_CATEGORIES).run();
      db.prepare(DELETE_CUSTOMERS).run();

      db.prepare(INSERT_CUSTOMERS).run(JSON.stringify(customers));
      db.prepare(INSERT_BUYS).run(JSON.stringify(buys));
      db.prepare(INSERT_SOLDS).run(JSON.stringify(solds));
      db.prepare(INSERT_SALE_ITEMS).run(JSON.stringify(saleItems));
      db.prepare(INSERT_EXPENSE_CATEGORIES).run(JSON.stringify(categories));
      db.prepare(INSERT_EXPENSES).run(JSON.stringify(expenses));
    });

    try {
      importAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new InvalidBackupError(`La copia no se puede restaurar: ${message}`);
    }

    runMigrations(db);

    return { ...counts, safety_backup: '' };
  }

  function restoreFromPath(path: string): RestoreSummary {
    const backup = openBackup(path);
    try {
      ensureDir();
      const safetyPath = uniquePath('pre-restauracion-');
      writeSnapshot(safetyPath);
      const summary = importFrom(backup);
      summary.safety_backup = safetyPath.split(/[\\/]/).pop() as string;
      return summary;
    } finally {
      backup.close();
    }
  }

  return {
    list,
    create,
    remove,
    backupsDir: () => backupsDir,
    pathOf,
    exists: (name: string) => existsSync(pathOf(name)),
    restoreFromBuffer(buffer: Buffer, originalName: string): RestoreSummary {
      if (buffer.length === 0) {
        throw new InvalidBackupError('El archivo está vacío');
      }
      ensureDir();
      const tempPath = join(backupsDir, `subida-${timestamp()}-${safeName(originalName)}`);
      try {
        writeFileSync(tempPath, buffer);
        return restoreFromPath(tempPath);
      } finally {
        if (existsSync(tempPath)) unlinkSync(tempPath);
      }
    },
    restoreFromStored(name: string): RestoreSummary {
      const path = pathOf(name);
      if (!existsSync(path)) throw new BackupNotFoundError(name);
      return restoreFromPath(path);
    },
  };
}
