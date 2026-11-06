import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createMetricsRepo } from '../repo/metrics-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { findEvent, planOf, recordSql, type SqlRecorder } from './helpers/sql-recorder.js';

const STRFTIME_SOLD_AT = /strftime\('%Y-%m',\s*\w*\.?sold_at\)\s*=/;
const STRFTIME_PURCHASE_DATE = /strftime\('%Y-%m',\s*purchase_date\)\s*=/;
const STRFTIME_EXPENSE_DATE = /strftime\('%Y-%m',\s*expense_date\)\s*=/;

describe('planes de ejecución de las consultas críticas', () => {
  let db: Database;
  let recorder: SqlRecorder;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    recorder = recordSql(db);

    const customersRepo = createCustomersRepo(recorder.db);
    const buysRepo = createBuysRepo(recorder.db);
    const soldsRepo = createSoldsRepo(recorder.db);

    customersRepo.create({ name: 'Ana' });
    buysRepo.create({
      product_name: 'Camiseta',
      purchase_cost: 20,
      quantity: 5,
      associated_costs: 0,
      purchase_date: '2026-02-01',
    });
    buysRepo.create({
      product_name: 'Zapatillas',
      purchase_cost: 45.5,
      quantity: 6,
      associated_costs: 0,
      purchase_date: '2026-02-02',
    });
    buysRepo.create({
      product_name: 'Gorra',
      purchase_cost: 8,
      quantity: 4,
      associated_costs: 0,
      purchase_date: '2026-03-02',
    });
    soldsRepo.createManyWithStockCheck({
      customer_id: 1,
      sale_price: 100,
      associated_costs: 0,
      sold_at: '2026-02-05',
      items: [
        { buy_id: 1, quantity: 2 },
        { buy_id: 2, quantity: 1 },
      ],
    });

    recorder.reset();
  });

  it('ninguna consulta de métricas filtra el mes envolviendo la fecha en strftime', () => {
    createMetricsRepo(recorder.db).stats();

    const offenders = recorder.executed.filter((event) => STRFTIME_SOLD_AT.test(event.sql));

    expect(offenders).toEqual([]);
  });

  it('la consulta de ventas del mes busca con el índice de sold_at', () => {
    createMetricsRepo(recorder.db).stats();

    const event = findEvent(
      recorder,
      (sql) => sql.includes('COUNT(*) AS ventas') && sql.includes('sold_at'),
    );
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).toContain('idx_solds_sold_at');
    expect(plan).not.toContain('SCAN solds');
  });

  it('la consulta de gastos del mes busca con el índice de expense_date', () => {
    createMetricsRepo(recorder.db).stats();

    const event = findEvent(
      recorder,
      (sql) => sql.includes('SUM(amount)') && sql.includes('expense_date'),
    );
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).toContain('idx_expenses_date');
    expect(plan).not.toContain('SCAN expenses');
  });

  it('ninguna serie mensual del dashboard envuelve la fecha en strftime', () => {
    createSoldsRepo(recorder.db).statsDashboard();

    const soldAtOffenders = recorder.executed.filter((event) => STRFTIME_SOLD_AT.test(event.sql));
    const purchaseDateOffenders = recorder.executed.filter((event) =>
      STRFTIME_PURCHASE_DATE.test(event.sql),
    );
    const expenseDateOffenders = recorder.executed.filter((event) =>
      STRFTIME_EXPENSE_DATE.test(event.sql),
    );

    expect(soldAtOffenders).toEqual([]);
    expect(purchaseDateOffenders).toEqual([]);
    expect(expenseDateOffenders).toEqual([]);
  });

  it('la serie mensual de compras usa los índices de fecha de compras y de ventas', () => {
    createSoldsRepo(recorder.db).statsDashboard();

    const event = findEvent(recorder, (sql) => sql.includes('compras_de_buys'));
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).toContain('idx_buys_purchase_date');
    expect(plan).toContain('idx_solds_sold_at');
  });

  it('el listado de compras con stock no agrega sale_items en bloque', () => {
    createBuysRepo(recorder.db).listWithStock();

    const event = findEvent(recorder, (sql) => sql.includes('AS disponibles'));
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).not.toContain('MATERIALIZE');
    expect(plan).not.toContain('AUTOMATIC');
    expect(plan).toContain('idx_sale_items_buy');
  });

  it('el stock disponible no agrega sale_items en bloque', () => {
    createBuysRepo(recorder.db).getWithStock();

    const event = findEvent(
      recorder,
      (sql) => sql.includes('AS disponibles') && sql.includes('> 0'),
    );
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).not.toContain('MATERIALIZE');
    expect(plan).not.toContain('AUTOMATIC');
    expect(plan).toContain('idx_sale_items_buy');
  });

  it('el recuento de stock pendiente no agrega sale_items en bloque', () => {
    createSoldsRepo(recorder.db).statsDashboard();

    const event = findEvent(
      recorder,
      (sql) => sql.includes('FROM buys b') && sql.includes('AS cnt'),
    );
    const plan = planOf(db, event.sql, event.params).join(' | ');

    expect(plan).not.toContain('MATERIALIZE');
    expect(plan).not.toContain('AUTOMATIC');
    expect(plan).toContain('idx_sale_items_buy');
  });

  it('crear una venta con varios ítems no compila SQL dentro del bucle', () => {
    const customersRepo = createCustomersRepo(recorder.db);
    const buysRepo = createBuysRepo(recorder.db);
    const soldsRepo = createSoldsRepo(recorder.db);

    customersRepo.create({ name: 'Beto' });
    const buyIds = [1, 2, 3].map(
      (index) =>
        buysRepo.create({
          product_name: `Gorra ${index}`,
          purchase_cost: 8,
          quantity: 10,
          associated_costs: 0,
        }).id,
    );

    recorder.reset();

    soldsRepo.createManyWithStockCheck({
      customer_id: 2,
      sale_price: 50,
      associated_costs: 0,
      items: [
        { buy_id: buyIds[0], quantity: 1 },
        { buy_id: buyIds[1], quantity: 2 },
        { buy_id: buyIds[2], quantity: 3 },
      ],
    });

    expect(recorder.prepared).toEqual([]);
  });
});
