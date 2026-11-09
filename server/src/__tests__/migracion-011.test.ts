import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

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
  '010_precio_compra_por_unidad.sql',
];

const MIGRATION_011 = '011_tags.sql';

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

function seedBuy(db: Database): void {
  db.exec(`
    INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at)
      VALUES ('Camiseta', 45.5, 6, 3.2, '2026-02-01', '2026-02-01T00:00:00.000Z');
  `);
}

function insertTag(db: Database, scope: string, name: string, color: string): void {
  db.prepare('INSERT INTO tags (scope, name, color, created_at) VALUES (?, ?, ?, ?)').run(
    scope,
    name,
    color,
    '2026-02-01T00:00:00.000Z',
  );
}

describe('migración 011: tags por ámbito con desasignación en cascada', () => {
  it('añade la columna buys.tag_id sin tocar las compras existentes', () => {
    const db = createLegacyDb();
    seedBuy(db);

    db.exec(readMigration(MIGRATION_011));

    const buy = db.prepare('SELECT id, product_name, tag_id FROM buys WHERE id = 1').get() as {
      id: number;
      product_name: string;
      tag_id: number | null;
    };

    expect(buy).toEqual({ id: 1, product_name: 'Camiseta', tag_id: null });

    db.close();
  });

  it('el nombre es único por catálogo e insensible a mayúsculas', () => {
    const db = createLegacyDb();
    db.exec(readMigration(MIGRATION_011));

    insertTag(db, 'buy', 'Navidad', '#ff0000');
    insertTag(db, 'sold', 'Navidad', '#00ff00');

    expect(() => insertTag(db, 'buy', 'navidad', '#0000ff')).toThrow();

    db.close();
  });

  it('el ámbito solo admite buy y sold', () => {
    const db = createLegacyDb();
    db.exec(readMigration(MIGRATION_011));

    expect(() => insertTag(db, 'other', 'X', '#000000')).toThrow();

    db.close();
  });

  it('borrar un tag desasigna sus compras y no borra ninguna compra', () => {
    const db = createLegacyDb();
    seedBuy(db);
    db.exec(readMigration(MIGRATION_011));

    insertTag(db, 'buy', 'Navidad', '#ff0000');
    db.prepare('UPDATE buys SET tag_id = 1 WHERE id = 1').run();

    db.prepare('DELETE FROM tags WHERE id = 1').run();

    const buy = db.prepare('SELECT id, tag_id FROM buys WHERE id = 1').get() as {
      id: number;
      tag_id: number | null;
    };
    const count = db.prepare('SELECT COUNT(*) AS n FROM buys').get() as { n: number };

    expect(buy).toEqual({ id: 1, tag_id: null });
    expect(count.n).toBe(1);

    db.close();
  });

  it('el runner de migraciones la aplica una sola vez', () => {
    const db = openDb(':memory:');

    runMigrations(db);
    runMigrations(db);

    const applied = db.prepare('SELECT COUNT(*) AS n FROM _migrations').get() as { n: number };
    const buy = db.prepare('SELECT tag_id FROM buys WHERE id = 1').get() as
      { tag_id: number | null } | undefined;

    expect(applied.n).toBe(LEGACY_MIGRATIONS.length + 1);
    expect(buy).toBeUndefined();

    db.close();
  });
});
