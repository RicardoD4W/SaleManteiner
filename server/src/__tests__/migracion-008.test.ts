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
  '007_notas_en_compras.sql',
];

const MIGRATION_008 = '008_deuda_pagada_por_defecto.sql';

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
    INSERT INTO solds (customer_id, sale_price, associated_costs, paid_amount, sold_at, notes, created_at)
      VALUES (1, 100, 3, 0, '2026-02-05', 'venta sin cobrar informado', '2026-02-05T00:00:00.000Z');
    INSERT INTO solds (customer_id, sale_price, associated_costs, paid_amount, sold_at, notes, created_at)
      VALUES (1, 200, 0, 40, '2026-02-06', 'venta con un cobro parcial', '2026-02-06T00:00:00.000Z');
    INSERT INTO solds (customer_id, sale_price, associated_costs, paid_amount, sold_at, notes, created_at)
      VALUES (1, 0, 0, 0, '2026-02-07', 'venta sin precio', '2026-02-07T00:00:00.000Z');
    INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (1, 1, 2);
    INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (2, 1, 3);
  `);
}

function soldById(db: Database, id: number): { paid_amount: number; sale_price: number } {
  return db.prepare('SELECT paid_amount, sale_price FROM solds WHERE id = ?').get(id) as {
    paid_amount: number;
    sale_price: number;
  };
}

describe('migración 008 sobre una base con datos previos', () => {
  it('las ventas sin importe cobrado pasan a estar pagadas íntegras', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));

    expect(soldById(db, 1)).toEqual({ paid_amount: 100, sale_price: 100 });

    db.close();
  });

  it('las ventas con un cobro informado conservan su importe', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));

    expect(soldById(db, 2)).toEqual({ paid_amount: 40, sale_price: 200 });

    db.close();
  });

  it('una venta sin precio se queda como estaba', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));

    expect(soldById(db, 3)).toEqual({ paid_amount: 0, sale_price: 0 });

    db.close();
  });

  it('no toca el resto de datos de la venta ni sus líneas', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));

    const sold = db.prepare('SELECT * FROM solds WHERE id = 1').get() as Record<string, unknown>;
    expect(sold).toMatchObject({
      id: 1,
      customer_id: 1,
      sale_price: 100,
      associated_costs: 3,
      sold_at: '2026-02-05',
      notes: 'venta sin cobrar informado',
      created_at: '2026-02-05T00:00:00.000Z',
    });

    const items = db.prepare('SELECT * FROM sale_items ORDER BY sold_id').all();
    expect(items).toEqual([
      { sold_id: 1, buy_id: 1, quantity: 2 },
      { sold_id: 2, buy_id: 1, quantity: 3 },
    ]);

    db.close();
  });

  it('la deuda por cliente queda a cero para las ventas migradas', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));

    const deuda = db
      .prepare('SELECT COALESCE(SUM(sale_price - paid_amount), 0) AS deuda FROM solds')
      .get() as { deuda: number };

    expect(deuda.deuda).toBe(160);

    db.close();
  });

  it('aplicarla dos veces no cambia nada más', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_008));
    db.exec(readMigration(MIGRATION_008));

    expect(soldById(db, 1)).toEqual({ paid_amount: 100, sale_price: 100 });
    expect(soldById(db, 2)).toEqual({ paid_amount: 40, sale_price: 200 });

    db.close();
  });
});
