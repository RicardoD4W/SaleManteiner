import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');

const LEGACY_MIGRATIONS = [
  '001_initial.sql',
  '002_purchase_date_and_manual_sold_at.sql',
  '003_buys_and_solds.sql',
  '004_vistas_cifras.sql',
  '005_indices_de_fecha.sql',
];

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf-8');
}

function createLegacyDb(): Database {
  const db = openDb(':memory:');
  for (const file of LEGACY_MIGRATIONS) {
    db.exec(readMigration(file));
  }
  return db;
}

function seedLegacyData(db: Database): void {
  db.exec(`
    INSERT INTO customers (name, created_at) VALUES ('Ana', '2026-01-01T00:00:00.000Z');
    INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at)
      VALUES ('Camiseta', 20, 5, 2, '2026-02-01', '2026-02-01T00:00:00.000Z');
    INSERT INTO solds (customer_id, sale_price, associated_costs, sold_at, notes, created_at)
      VALUES (1, 100, 3, '2026-02-05', 'venta inicial', '2026-02-05T00:00:00.000Z');
    INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (1, 1, 2);
  `);
}

function columnsOf(db: Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function indexesOf(db: Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

describe('migración 006 sobre una base con datos previos', () => {
  it('aplica la migración 006 sin tocar los datos existentes', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    const customer = db.prepare('SELECT * FROM customers WHERE id = 1').get() as {
      name: string;
      created_at: string;
    };
    expect(customer.name).toBe('Ana');
    expect(customer.created_at).toBe('2026-01-01T00:00:00.000Z');

    const buy = db.prepare('SELECT * FROM buys WHERE id = 1').get() as {
      product_name: string;
      purchase_cost: number;
      quantity: number;
      associated_costs: number;
      purchase_date: string;
    };
    expect(buy).toMatchObject({
      product_name: 'Camiseta',
      purchase_cost: 20,
      quantity: 5,
      associated_costs: 2,
      purchase_date: '2026-02-01',
    });

    const sold = db.prepare('SELECT * FROM solds WHERE id = 1').get() as {
      customer_id: number;
      sale_price: number;
      associated_costs: number;
      sold_at: string;
      notes: string;
    };
    expect(sold).toMatchObject({
      customer_id: 1,
      sale_price: 100,
      associated_costs: 3,
      sold_at: '2026-02-05',
      notes: 'venta inicial',
    });

    const items = db.prepare('SELECT * FROM sale_items').all() as Array<{
      sold_id: number;
      buy_id: number;
      quantity: number;
    }>;
    expect(items).toEqual([{ sold_id: 1, buy_id: 1, quantity: 2 }]);

    db.close();
  });

  it('los clientes existentes quedan con phone, address y notes a NULL', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    const customer = db.prepare('SELECT * FROM customers WHERE id = 1').get() as {
      phone: string | null;
      address: string | null;
      notes: string | null;
    };
    expect(customer.phone).toBeNull();
    expect(customer.address).toBeNull();
    expect(customer.notes).toBeNull();

    db.close();
  });

  it('las ventas existentes quedan con paid_amount en 0', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    const sold = db.prepare('SELECT * FROM solds WHERE id = 1').get() as { paid_amount: number };
    expect(sold.paid_amount).toBe(0);

    db.close();
  });

  it('añade las columnas nuevas a customers y solds', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    expect(columnsOf(db, 'customers')).toEqual(
      expect.arrayContaining(['id', 'name', 'created_at', 'phone', 'address', 'notes']),
    );
    expect(columnsOf(db, 'solds')).toEqual(
      expect.arrayContaining(['id', 'customer_id', 'sale_price', 'paid_amount']),
    );

    db.close();
  });

  it('crea las tablas de gastos y categorías sin sembrar ninguna fila', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    expect(columnsOf(db, 'expense_categories')).toEqual(
      expect.arrayContaining(['id', 'name', 'created_at']),
    );
    expect(columnsOf(db, 'expenses')).toEqual(
      expect.arrayContaining([
        'id',
        'concept',
        'amount',
        'category_id',
        'expense_date',
        'created_at',
      ]),
    );

    const categories = db.prepare('SELECT COUNT(*) AS c FROM expense_categories').get() as {
      c: number;
    };
    const expenses = db.prepare('SELECT COUNT(*) AS c FROM expenses').get() as { c: number };
    expect(categories.c).toBe(0);
    expect(expenses.c).toBe(0);

    db.close();
  });

  it('crea los índices de gastos por fecha y por categoría', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    expect(indexesOf(db, 'expenses')).toEqual(
      expect.arrayContaining(['idx_expenses_date', 'idx_expenses_category']),
    );

    db.close();
  });

  it('el gasto pertenece a una categoría y la categoría no se puede borrar mientras se use', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('006_gastos_y_ficha_cliente.sql'));

    db.exec(`
      INSERT INTO expense_categories (name, created_at) VALUES ('Alquiler', '2026-03-01T00:00:00.000Z');
      INSERT INTO expenses (concept, amount, category_id, expense_date, created_at)
        VALUES ('Alquiler de marzo', 400, 1, '2026-03-01', '2026-03-01T00:00:00.000Z');
    `);

    expect(() => db.prepare('DELETE FROM expense_categories WHERE id = 1').run()).toThrow();

    db.close();
  });
});
