import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createBackupService, InvalidBackupError } from '../backup/backup-service.js';
import { CreateCustomerInput } from '../schemas/customers.js';
import { CreateBuyInput } from '../schemas/buys.js';

describe('copias de seguridad de la base de datos', () => {
  let dir: string;
  let db: DatabaseType;
  let service: ReturnType<typeof createBackupService>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'salemanteiner-backup-'));
    db = openDb(join(dir, 'data.db'));
    runMigrations(db);
    service = createBackupService({ db, dbPath: join(dir, 'data.db') });
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function seedCustomer(name: string): number {
    return createCustomersRepo(db).create(CreateCustomerInput.parse({ name })).id;
  }

  function customerNames(): string[] {
    return (
      db.prepare('SELECT name FROM customers ORDER BY id').all() as Array<{ name: string }>
    ).map((row) => row.name);
  }

  it('crea una copia con fecha en la carpeta backups y la lista', () => {
    const backup = service.create();

    expect(backup.name).toMatch(/^salemanteiner-\d{8}-\d{6}(-\d+)?\.db$/);
    expect(backup.size).toBeGreaterThan(0);
    expect(service.list()).toHaveLength(1);
    expect(service.list()[0].name).toBe(backup.name);
    expect(readdirSync(join(dir, 'backups')).length).toBe(1);
  });

  it('la copia es una base de datos válida con los mismos datos', () => {
    seedCustomer('Ana');
    const backup = service.create();

    const copy = new Database(join(dir, 'backups', backup.name), { readonly: true });
    try {
      const rows = copy.prepare('SELECT name FROM customers').all() as Array<{ name: string }>;
      expect(rows).toEqual([{ name: 'Ana' }]);
    } finally {
      copy.close();
    }
  });

  it('elimina una copia', () => {
    const backup = service.create();

    service.remove(backup.name);

    expect(service.list()).toEqual([]);
  });

  it('rechaza nombres de copia con rutas y no toca la base de datos', () => {
    seedCustomer('Ana');

    expect(() => service.pathOf('../data.db')).toThrow(InvalidBackupError);
    expect(customerNames()).toEqual(['Ana']);
  });

  it('rechaza un archivo que no es una base de datos y no toca los datos', () => {
    seedCustomer('Ana');

    expect(() => service.restoreFromBuffer(Buffer.from('esto no es una BD'), 'basura.db')).toThrow(
      InvalidBackupError,
    );
    expect(customerNames()).toEqual(['Ana']);
  });

  it('rechaza una base de datos sin las tablas de SaleManteiner', () => {
    const emptyPath = join(dir, 'vacia.db');
    const empty = new Database(emptyPath);
    empty.exec('CREATE TABLE otra (id INTEGER PRIMARY KEY)');
    empty.close();

    expect(() => service.restoreFromBuffer(readFileSync(emptyPath), 'vacia.db')).toThrow(
      InvalidBackupError,
    );
    expect(customerNames()).toEqual([]);
  });

  it('restaura una copia: reemplaza los datos y deja una copia de seguridad previa', () => {
    seedCustomer('Ana');
    createBuysRepo(db).create(CreateBuyInput.parse({ product_name: 'Widget', purchase_cost: 10 }));
    const backup = service.create();

    seedCustomer('Beto');
    expect(customerNames()).toEqual(['Ana', 'Beto']);

    const summary = service.restoreFromStored(backup.name);

    expect(summary.customers).toBe(1);
    expect(summary.buys).toBe(1);
    expect(summary.safety_backup).toMatch(/^pre-restauracion-\d{8}-\d{6}(-\d+)?\.db$/);
    expect(customerNames()).toEqual(['Ana']);
    expect(service.list().map((file) => file.name)).toContain(summary.safety_backup);
  });

  it('restaura desde un archivo subido por el usuario', () => {
    seedCustomer('Ana');
    const backup = service.create();
    const bytes = readFileSync(join(dir, 'backups', backup.name));

    seedCustomer('Beto');

    const summary = service.restoreFromBuffer(bytes, 'copia-descargada.db');

    expect(summary.customers).toBe(1);
    expect(customerNames()).toEqual(['Ana']);
  });

  it('deja la base de datos intacta si la copia no se puede importar', () => {
    seedCustomer('Ana');
    const brokenPath = join(dir, 'rota.db');
    const broken = new Database(brokenPath);
    broken.exec('CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    broken.prepare('INSERT INTO customers (name) VALUES (?)').run('Fantasma');
    broken.close();

    expect(() => service.restoreFromBuffer(readFileSync(brokenPath), 'rota.db')).toThrow(
      InvalidBackupError,
    );
    expect(customerNames()).toEqual(['Ana']);
  });
});
