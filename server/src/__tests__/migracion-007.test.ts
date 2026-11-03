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
  '006_gastos_y_ficha_cliente.sql',
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

describe('migración 007 sobre una base con datos previos', () => {
  it('añade la columna notes a buys sin tocar los datos existentes', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('007_notas_en_compras.sql'));

    expect(columnsOf(db, 'buys')).toEqual(
      expect.arrayContaining(['id', 'product_name', 'purchase_cost', 'notes']),
    );

    const buy = db.prepare('SELECT * FROM buys WHERE id = 1').get() as {
      product_name: string;
      purchase_cost: number;
      quantity: number;
      associated_costs: number;
      purchase_date: string;
      notes: string | null;
    };
    expect(buy).toMatchObject({
      product_name: 'Camiseta',
      purchase_cost: 20,
      quantity: 5,
      associated_costs: 2,
      purchase_date: '2026-02-01',
    });
    expect(buy.notes).toBeNull();

    db.close();
  });

  it('no toca clientes ni ventas', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('007_notas_en_compras.sql'));

    const customer = db.prepare('SELECT * FROM customers WHERE id = 1').get() as {
      name: string;
    };
    expect(customer.name).toBe('Ana');

    const sold = db.prepare('SELECT * FROM solds WHERE id = 1').get() as {
      sale_price: number;
      notes: string;
    };
    expect(sold.sale_price).toBe(100);
    expect(sold.notes).toBe('venta inicial');

    db.close();
  });

  it('acepta guardar notas en una compra existente', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration('007_notas_en_compras.sql'));
    db.prepare('UPDATE buys SET notes = ? WHERE id = 1').run('pedido urgente');

    const buy = db.prepare('SELECT notes FROM buys WHERE id = 1').get() as { notes: string };
    expect(buy.notes).toBe('pedido urgente');

    db.close();
  });
});
