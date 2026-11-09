import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createExpensesRepo, createExpenseCategoriesRepo } from '../repo/expenses-repo.js';
import { createMetricsRepo } from '../repo/metrics-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { monthKey, shiftMonth } from '../lib/months.js';

function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

describe('las ventas y los gastos caen en el mes que les toca', () => {
  let db: Database;
  let buysRepo: ReturnType<typeof createBuysRepo>;
  let soldsRepo: ReturnType<typeof createSoldsRepo>;
  let customersRepo: ReturnType<typeof createCustomersRepo>;
  let expensesRepo: ReturnType<typeof createExpensesRepo>;
  let metricsRepo: ReturnType<typeof createMetricsRepo>;
  const current = monthKey(new Date());
  const previous = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buysRepo = createBuysRepo(db);
    soldsRepo = createSoldsRepo(db);
    customersRepo = createCustomersRepo(db);
    expensesRepo = createExpensesRepo(db);
    metricsRepo = createMetricsRepo(db);

    customersRepo.create({ name: 'Ana' });
    createExpenseCategoriesRepo(db).create({ name: 'Alquiler' });
    const buy = buysRepo.create({
      product_name: 'Camiseta',
      purchase_cost: 10,
      quantity: 20,
      associated_costs: 0,
      purchase_date: `${previous}-01`,
    });

    const saleOn = (soldAt: string): void => {
      soldsRepo.createManyWithStockCheck({
        customer_id: 1,
        sale_price: 100,
        associated_costs: 0,
        sold_at: soldAt,
        items: [{ buy_id: buy.id, quantity: 1 }],
      });
    };

    saleOn(lastDayOf(previous));
    saleOn(`${current}-01`);
    saleOn(lastDayOf(current));
    saleOn(`${next}-01`);

    expensesRepo.create({
      concept: 'Alquiler',
      amount: 50,
      category_id: 1,
      expense_date: `${current}-01`,
    });
    expensesRepo.create({
      concept: 'Suministros',
      amount: 25,
      category_id: 1,
      expense_date: `${next}-01`,
    });
  });

  it('el mes actual agrupa las ventas de su primer y su último día', () => {
    const stats = metricsRepo.stats();

    expect(stats.mes_actual.month).toBe(current);
    expect(stats.mes_actual.ventas).toBe(2);
    expect(stats.mes_actual.ingresos).toBe(200);
    expect(stats.mes_actual.gastos).toBe(50);
  });

  it('el mes anterior solo recoge la venta de su último día', () => {
    const stats = metricsRepo.stats();

    expect(stats.mes_anterior.month).toBe(previous);
    expect(stats.mes_anterior.ventas).toBe(1);
    expect(stats.mes_anterior.ingresos).toBe(100);
    expect(stats.mes_anterior.gastos).toBe(0);
  });

  it('la venta del mes siguiente no se cuela en el mes actual', () => {
    const stats = metricsRepo.stats();

    expect(stats.mes_actual.ventas).toBe(2);
    expect(stats.mes_anterior.ventas).toBe(1);
  });

  it('las series mensuales del dashboard colocan cada venta en su mes', () => {
    const stats = soldsRepo.statsDashboard();

    const currentMonth = stats.cashFlowByMonth.find((month) => month.month === current);
    const previousMonth = stats.cashFlowByMonth.find((month) => month.month === previous);

    expect(currentMonth?.ingresos).toBe(200);
    expect(previousMonth?.ingresos).toBe(100);
  });
});
