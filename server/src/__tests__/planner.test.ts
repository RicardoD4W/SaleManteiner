import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

const LIST_BY_CUSTOMER_SQL = `
  SELECT s.id, s.customer_id
  FROM solds s
  WHERE s.customer_id = ?
    AND (? IS NULL OR s.sold_at >= ?)
    AND (? IS NULL OR s.sold_at <= ?)
`;

const LIST_BY_DATE_SQL = `
  SELECT s.id
  FROM solds s
  WHERE (? IS NULL OR s.customer_id = ?)
    AND (? IS NULL OR s.sold_at >= ?)
    AND (? IS NULL OR s.sold_at <= ?)
`;

interface PlanRow {
  detail: string;
}

function plan(db: Database, sql: string, params: unknown[]): string[] {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as PlanRow[];
  return rows.map((r) => r.detail);
}

describe('el planner usa los índices que valen', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  it('el filtro por cliente usa el índice de clientes', () => {
    const detalles = plan(db, LIST_BY_CUSTOMER_SQL, [1, null, null, null, null]);

    expect(detalles.join(' | ')).toMatch(/USING INDEX idx_solds_customer/);
  });

  it('el filtro por fecha no usa un índice (no hay rango que derivar) y no lo necesita', () => {
    const detalles = plan(db, LIST_BY_DATE_SQL, [
      null,
      null,
      '2026-01-01',
      null,
      null,
      '2026-12-31',
    ]);

    expect(detalles.join(' | ')).not.toMatch(/idx_solds_sold_at/);
    expect(detalles.join(' | ')).not.toMatch(/idx_buys_purchase_date/);
  });

  it('los índices de fecha ya no existen (se fueron a propósito)', () => {
    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;
    const nombres = indices.map((i) => i.name);

    expect(nombres).not.toContain('idx_solds_sold_at');
    expect(nombres).not.toContain('idx_buys_purchase_date');
    expect(nombres).not.toContain('idx_sale_items_sold');
    expect(nombres).not.toContain('idx_customers_name');
    expect(nombres).toContain('idx_solds_customer');
    expect(nombres).toContain('idx_sale_items_buy');
  });
});
