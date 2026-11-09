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
  '008_deuda_pagada_por_defecto.sql',
  '009_indices_performance.sql',
];

const MIGRATION_010 = '010_precio_compra_por_unidad.sql';

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
      VALUES ('Camiseta', 45.5, 6, 3.2, '2026-02-01', '2026-02-01T00:00:00.000Z');
    INSERT INTO solds (customer_id, sale_price, associated_costs, paid_amount, sold_at, notes, created_at)
      VALUES (1, 100, 5, 0, '2026-02-05', 'venta', '2026-02-05T00:00:00.000Z');
    INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (1, 1, 2);
  `);
}

function unitCosts(db: Database): Array<{ unit_cost: number; unit_assoc: number }> {
  return db.prepare('SELECT unit_cost, unit_assoc FROM v_item_costs').all() as Array<{
    unit_cost: number;
    unit_assoc: number;
  }>;
}

describe('migración 010: el coste de compra pasa a ser el precio por unidad', () => {
  it('la vista expone el precio unitario tal cual, sin dividir por la cantidad', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_010));

    expect(unitCosts(db)[0]).toEqual({ unit_cost: 45.5, unit_assoc: 0.53 });

    db.close();
  });

  it('no reescribe el coste de compra guardado: la conversión la hace el usuario a mano', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_010));

    const buy = db.prepare('SELECT purchase_cost, quantity FROM buys WHERE id = 1').get() as {
      purchase_cost: number;
      quantity: number;
    };

    expect(buy).toEqual({ purchase_cost: 45.5, quantity: 6 });

    db.close();
  });

  it('el beneficio de la venta se calcula con el precio unitario', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_010));

    const row = db.prepare('SELECT profit FROM v_sold_costs WHERE sold_id = 1').get() as {
      profit: number;
    };

    expect(row.profit).toBeCloseTo(100 - 5 - 2 * 45.5 - 2 * 0.53, 10);

    db.close();
  });

  it('aplicarla dos veces no cambia nada más', () => {
    const db = createLegacyDb();
    seedLegacyData(db);

    db.exec(readMigration(MIGRATION_010));
    db.exec(readMigration(MIGRATION_010));

    expect(unitCosts(db)[0]).toEqual({ unit_cost: 45.5, unit_assoc: 0.53 });

    db.close();
  });
});
