import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');

const MIGRATIONS = [
  '001_initial.sql',
  '002_purchase_date_and_manual_sold_at.sql',
  '003_buys_and_solds.sql',
  '004_vistas_cifras.sql',
  '005_indices_de_fecha.sql',
  '006_gastos_y_ficha_cliente.sql',
  '007_notas_en_compras.sql',
  '008_deuda_pagada_por_defecto.sql',
];

const MIGRATION_009 = '009_indices_performance.sql';

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf-8');
}

function legacyDb(): Database {
  const db = openDb(':memory:');
  for (const file of MIGRATIONS) db.exec(readMigration(file));
  return db;
}

function indexNames(db: Database): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

describe('migración 009: índices de performance', () => {
  it('recrea los índices de fecha que 004 y 005 borraron', () => {
    const db = openDb(':memory:');
    runMigrations(db);

    const names = indexNames(db);

    expect(names).toContain('idx_buys_purchase_date');
    expect(names).toContain('idx_solds_sold_at');
    expect(names).not.toContain('idx_customers_name');

    db.close();
  });

  it('es aditiva: los datos previos siguen intactos', () => {
    const db = legacyDb();
    db.exec(`
      INSERT INTO customers (name, created_at) VALUES ('Ana', '2026-01-01T00:00:00.000Z');
      INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at)
        VALUES ('Camiseta', 20, 5, 2, '2026-02-01', '2026-02-01T00:00:00.000Z');
      INSERT INTO solds (customer_id, sale_price, associated_costs, paid_amount, sold_at, created_at)
        VALUES (1, 100, 3, 100, '2026-02-05', '2026-02-05T00:00:00.000Z');
      INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (1, 1, 2);
    `);

    db.exec(readMigration(MIGRATION_009));

    expect(db.prepare('SELECT COUNT(*) AS c FROM buys').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM solds').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM sale_items').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT * FROM buys WHERE id = 1').get()).toMatchObject({
      product_name: 'Camiseta',
      purchase_cost: 20,
      quantity: 5,
      associated_costs: 2,
      purchase_date: '2026-02-01',
    });

    db.close();
  });

  it('aplicarla dos veces no duplica índices ni falla', () => {
    const db = legacyDb();

    db.exec(readMigration(MIGRATION_009));
    db.exec(readMigration(MIGRATION_009));

    expect(
      indexNames(db)
        .filter((name) => name.startsWith('idx_'))
        .sort(),
    ).toEqual([
      'idx_buys_purchase_date',
      'idx_expenses_category',
      'idx_expenses_date',
      'idx_sale_items_buy',
      'idx_solds_customer',
      'idx_solds_sold_at',
    ]);

    db.close();
  });
});
