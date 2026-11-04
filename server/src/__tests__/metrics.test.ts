import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createExpenseCategoriesRepo, createExpensesRepo } from '../repo/expenses-repo.js';
import { createMetricsRepo } from '../repo/metrics-repo.js';
import { CreateBuyInput } from '../schemas/buys.js';
import { CreateSoldInput } from '../schemas/solds.js';
import { CreateExpenseInput } from '../schemas/expenses.js';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateInMonth(offsetMonths: number, day = 15): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offsetMonths, day);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(day)}`;
}

function monthKey(offsetMonths: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;
}

describe('métricas del dashboard', () => {
  let db: Database;
  let metrics: ReturnType<typeof createMetricsRepo>;
  let buys: ReturnType<typeof createBuysRepo>;
  let solds: ReturnType<typeof createSoldsRepo>;
  let customers: ReturnType<typeof createCustomersRepo>;
  let expenses: ReturnType<typeof createExpensesRepo>;
  let categories: ReturnType<typeof createExpenseCategoriesRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buys = createBuysRepo(db);
    solds = createSoldsRepo(db);
    customers = createCustomersRepo(db);
    categories = createExpenseCategoriesRepo(db);
    expenses = createExpensesRepo(db);
    metrics = createMetricsRepo(db);
  });

  function seed(): void {
    const ana = customers.create({ name: 'Ana' });
    const beto = customers.create({ name: 'Beto' });

    const widget = buys.create(
      CreateBuyInput.parse({
        product_name: 'Widget',
        purchase_cost: 100,
        quantity: 2,
        purchase_date: dateInMonth(0),
      }),
    );
    buys.create(
      CreateBuyInput.parse({
        product_name: 'Zapatillas',
        purchase_cost: 30,
        quantity: 3,
        purchase_date: dateInMonth(0),
      }),
    );
    const old = buys.create(
      CreateBuyInput.parse({
        product_name: 'Old',
        purchase_cost: 50,
        quantity: 1,
        purchase_date: dateInMonth(-1),
      }),
    );

    solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: ana.id,
        sale_price: 200,
        sold_at: dateInMonth(0),
        items: [{ buy_id: widget.id, quantity: 2 }],
      }),
    );
    solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: beto.id,
        sale_price: 100,
        paid_amount: 100,
        sold_at: dateInMonth(-1),
        items: [{ buy_id: old.id, quantity: 1 }],
      }),
    );

    const alquiler = categories.create({ name: 'Alquiler' });
    const suministros = categories.create({ name: 'Suministros' });
    expenses.create(
      CreateExpenseInput.parse({
        concept: 'Alquiler del taller',
        amount: 50,
        category_id: alquiler.id,
        expense_date: dateInMonth(0),
      }),
    );
    expenses.create(
      CreateExpenseInput.parse({
        concept: 'Cajas',
        amount: 25,
        category_id: suministros.id,
        expense_date: dateInMonth(0),
      }),
    );
  }

  it('calcula los KPIs globales, el margen y el reparto por categoría', () => {
    seed();

    const stats = metrics.stats();

    expect(stats.kpis.ingresos_total_eur).toBe(300);
    expect(stats.kpis.beneficio_total_eur).toBe(150);
    expect(stats.kpis.gastos_total_eur).toBe(75);
    expect(stats.kpis.beneficio_neto_eur).toBe(75);
    expect(stats.kpis.margen_pct).toBe(50);
    expect(stats.kpis.gastos_sobre_ingresos_pct).toBe(25);
    expect(stats.kpis.ticket_medio_eur).toBe(150);
    expect(stats.kpis.beneficio_medio_venta_eur).toBe(75);
    expect(stats.kpis.ventas_count).toBe(2);
    expect(stats.kpis.clientes_count).toBe(2);
    expect(stats.kpis.clientes_con_deuda).toBe(1);
    expect(stats.kpis.deuda_total_eur).toBe(200);
    expect(stats.kpis.stock_pendiente_count).toBe(1);
    expect(stats.kpis.stock_coste_total_eur).toBe(30);

    expect(stats.gastos_categoria).toEqual([
      { category_id: expect.any(Number), name: 'Alquiler', total: 50, pct: 66.67 },
      { category_id: expect.any(Number), name: 'Suministros', total: 25, pct: 33.33 },
    ]);
  });

  it('compara el mes actual con el mes anterior', () => {
    seed();

    const stats = metrics.stats();

    expect(stats.mes_actual.month).toBe(monthKey(0));
    expect(stats.mes_actual).toMatchObject({
      ingresos: 200,
      beneficio: 100,
      gastos: 75,
      resultado: 25,
      margen_pct: 50,
      ventas: 1,
    });

    expect(stats.mes_anterior.month).toBe(monthKey(-1));
    expect(stats.mes_anterior).toMatchObject({
      ingresos: 100,
      beneficio: 50,
      gastos: 0,
      resultado: 50,
      margen_pct: 50,
      ventas: 1,
    });

    expect(stats.variaciones).toEqual({
      ingresos_pct: 100,
      beneficio_pct: 100,
      gastos_pct: null,
      resultado_pct: -50,
      margen_puntos: 0,
    });
  });

  it('no hay variación cuando el mes anterior no tuvo actividad', () => {
    const ana = customers.create({ name: 'Ana' });
    const buy = buys.create(
      CreateBuyInput.parse({ product_name: 'Widget', purchase_cost: 10, quantity: 1 }),
    );
    solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: ana.id,
        sale_price: 50,
        sold_at: dateInMonth(0),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = metrics.stats();

    expect(stats.variaciones).toBeNull();
  });

  it('devuelve el margen de cada producto y los clientes con deuda', () => {
    seed();

    const stats = metrics.stats();

    expect(stats.margen_productos).toHaveLength(2);
    expect(stats.margen_productos[0]).toMatchObject({
      product_name: 'Widget',
      unidades: 2,
      ingresos: 200,
      beneficio: 100,
      margen_pct: 50,
    });
    expect(stats.margen_productos[1]).toMatchObject({
      product_name: 'Old',
      unidades: 1,
      ingresos: 100,
      beneficio: 50,
      margen_pct: 50,
    });

    expect(stats.deudores).toHaveLength(1);
    expect(stats.deudores[0]).toMatchObject({ customer_name: 'Ana', ventas: 1, deuda: 200 });
  });

  it('con la base vacía devuelve ceros y sin comparativa', () => {
    const stats = metrics.stats();

    expect(stats.kpis).toMatchObject({
      ingresos_total_eur: 0,
      beneficio_total_eur: 0,
      gastos_total_eur: 0,
      beneficio_neto_eur: 0,
      margen_pct: 0,
      gastos_sobre_ingresos_pct: 0,
      ticket_medio_eur: 0,
      beneficio_medio_venta_eur: 0,
      ventas_count: 0,
      clientes_count: 0,
      clientes_con_deuda: 0,
      deuda_total_eur: 0,
      stock_pendiente_count: 0,
      stock_coste_total_eur: 0,
    });
    expect(stats.variaciones).toBeNull();
    expect(stats.margen_productos).toEqual([]);
    expect(stats.deudores).toEqual([]);
    expect(stats.gastos_categoria).toEqual([]);
  });
});
