import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { CreateBuyInput } from '../schemas/buys.js';
import { CreateSoldInput } from '../schemas/solds.js';
import { CreateCustomerInput } from '../schemas/customers.js';

function todayLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function validBuy(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof CreateBuyInput.parse> {
  return CreateBuyInput.parse({ product_name: 'X', purchase_cost: 0, quantity: 1, ...overrides });
}

function validSold(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof CreateSoldInput.parse> {
  return CreateSoldInput.parse({
    customer_id: 1,
    sale_price: 0,
    items: [{ buy_id: 1, quantity: 1 }],
    ...overrides,
  });
}

function validCustomer(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof CreateCustomerInput.parse> {
  return CreateCustomerInput.parse({ name: 'Test', ...overrides });
}

describe('statsDashboard (nuevo modelo)', () => {
  let db: Database;
  let buysRepo: ReturnType<typeof createBuysRepo>;
  let soldsRepo: ReturnType<typeof createSoldsRepo>;
  let customersRepo: ReturnType<typeof createCustomersRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buysRepo = createBuysRepo(db);
    soldsRepo = createSoldsRepo(db);
    customersRepo = createCustomersRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('BD vacía: KPIs en cero, 12 meses con 0, sin top products ni buyers', () => {
    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.compras_total_eur).toBe(0);
    expect(stats.kpis.ventas_total_eur).toBe(0);
    expect(stats.kpis.beneficio_total_eur).toBe(0);
    expect(stats.kpis.stock_pendiente_count).toBe(0);
    expect(stats.cashFlowByMonth).toHaveLength(12);
    stats.cashFlowByMonth.forEach((m) => {
      expect(m.compras).toBe(0);
      expect(m.ingresos).toBe(0);
      expect(m.beneficio).toBe(0);
      expect(m.resultado).toBe(0);
    });
    expect(stats.topProducts).toHaveLength(0);
    expect(stats.topBuyers).toHaveLength(0);
  });

  it('cashFlowByMonth: formato YYYY-MM, ordenado ascendente, 12 puntos', () => {
    const stats = soldsRepo.statsDashboard();
    const months = stats.cashFlowByMonth.map((m) => m.month);
    expect(months).toHaveLength(12);
    for (const month of months) {
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    }
    for (let i = 1; i < months.length; i++) {
      expect(months[i]! > months[i - 1]!).toBe(true);
    }
  });

  it('totals12m: los totales y el mejor mes de los últimos 12 meses', () => {
    const customer = customersRepo.create(validCustomer({ name: 'Juan' }));
    const buy = buysRepo.create(
      validBuy({
        product_name: 'Funda',
        purchase_cost: 5,
        quantity: 10,
        purchase_date: todayLocalDate(),
      }),
    );

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 8,
        associated_costs: 1,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );
    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 20,
        associated_costs: 1,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();

    expect(stats.totals12m.ingresos).toBe(28);
    expect(stats.totals12m.beneficio).toBe(25);
    expect(stats.totals12m.mejor_mes?.month).toBe(todayLocalDate().slice(0, 7));
    expect(stats.totals12m.mejor_mes?.ingresos).toBe(28);
  });

  it('totals12m: sin ventas no hay mejor mes', () => {
    const stats = soldsRepo.statsDashboard();

    expect(stats.totals12m.ingresos).toBe(0);
    expect(stats.totals12m.beneficio).toBe(0);
    expect(stats.totals12m.mejor_mes).toBeNull();
  });

  it('una venta del mes actual aparece en el último slot y en topProducts', () => {
    const customer = customersRepo.create(validCustomer({ name: 'Juan' }));
    const buy = buysRepo.create(
      validBuy({
        product_name: 'Funda',
        purchase_cost: 5,
        quantity: 10,
        purchase_date: todayLocalDate(),
      }),
    );

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 8,
        associated_costs: 1,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    const currentMonth = stats.cashFlowByMonth[11]!;
    expect(currentMonth.compras).toBe(6);
    expect(currentMonth.ingresos).toBe(8);
    expect(currentMonth.beneficio).toBe(6.5);
    expect(currentMonth.resultado).toBe(1.5);

    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toMatchObject({
      product_name: 'Funda',
      times_sold: 1,
      total_revenue: 8,
    });

    expect(stats.topBuyers).toHaveLength(1);
    expect(stats.topBuyers[0]).toMatchObject({
      customer_name: 'Juan',
      ventas: 1,
      total_gastado: 8,
    });
  });

  it('compras_total_eur suma purchase_cost + associated_costs de buys', () => {
    buysRepo.create(validBuy({ product_name: 'A', purchase_cost: 100, associated_costs: 10 }));
    buysRepo.create(validBuy({ product_name: 'B', purchase_cost: 50, associated_costs: 5 }));

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.compras_total_eur).toBe(165);
  });

  it('compras_total_eur incluye también los costes asociados de las ventas', () => {
    const buy = buysRepo.create(
      validBuy({ product_name: 'A', purchase_cost: 100, associated_costs: 10, quantity: 10 }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 50,
        associated_costs: 7,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.compras_total_eur).toBe(117);
  });

  it('stock_pendiente_count cuenta buys con disponibles > 0', () => {
    const buy = buysRepo.create(validBuy({ product_name: 'X', purchase_cost: 30, quantity: 3 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 20,
        items: [{ buy_id: buy.id, quantity: 2 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.stock_pendiente_count).toBe(1);
  });

  it('buy vendido completamente no suma en stock_pendiente_count', () => {
    const buy = buysRepo.create(validBuy({ product_name: 'X', purchase_cost: 30, quantity: 1 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 50,
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.stock_pendiente_count).toBe(0);
  });

  it('topProducts: ordena por total_revenue DESC', () => {
    const c = customersRepo.create(validCustomer({ name: 'C' }));
    const a = buysRepo.create(validBuy({ product_name: 'A', purchase_cost: 10, quantity: 1 }));
    const b = buysRepo.create(validBuy({ product_name: 'B', purchase_cost: 10, quantity: 1 }));

    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: c.id, sale_price: 5, items: [{ buy_id: a.id, quantity: 1 }] }),
    );
    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: c.id, sale_price: 20, items: [{ buy_id: b.id, quantity: 1 }] }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topProducts.map((p) => p.product_name)).toEqual(['B', 'A']);
  });

  it('topBuyers: ordena por total_gastado DESC, top 10', () => {
    const c1 = customersRepo.create(validCustomer({ name: 'Ana' }));
    const c2 = customersRepo.create(validCustomer({ name: 'Luis' }));
    const buy1 = buysRepo.create(validBuy({ product_name: 'X', purchase_cost: 10, quantity: 5 }));
    const buy2 = buysRepo.create(validBuy({ product_name: 'Y', purchase_cost: 10, quantity: 5 }));

    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: c1.id, sale_price: 100, items: [{ buy_id: buy1.id, quantity: 2 }] }),
    );
    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: c2.id, sale_price: 30, items: [{ buy_id: buy2.id, quantity: 1 }] }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topBuyers[0]).toMatchObject({ customer_name: 'Ana', total_gastado: 100 });
    expect(stats.topBuyers[1]).toMatchObject({ customer_name: 'Luis', total_gastado: 30 });
  });

  it('mismo buy vendido varias veces: times_sold suma la cantidad (SUM(quantity))', () => {
    const customer = customersRepo.create(validCustomer({ name: 'C' }));
    const buy = buysRepo.create(validBuy({ product_name: 'Pack', purchase_cost: 60, quantity: 5 }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 20,
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );
    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 22,
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toMatchObject({
      product_name: 'Pack',
      times_sold: 2,
    });
  });

  it('topProducts.times_sold = unidades vendidas (SUM(quantity)), no count de sale_items', () => {
    const buy = buysRepo.create(
      validBuy({ product_name: 'sobre pokemon', purchase_cost: 10, quantity: 10 }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'Pepe' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 9,
        items: [{ buy_id: buy.id, quantity: 2 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toMatchObject({
      product_name: 'sobre pokemon',
      times_sold: 2,
    });
  });

  it('beneficio_total_eur: NO resta el coste de compras sin vender (solo COGS)', () => {
    const buy = buysRepo.create(
      validBuy({ product_name: 'Funda', purchase_cost: 100, quantity: 20 }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 50,
        associated_costs: 0,
        items: [{ buy_id: buy.id, quantity: 5 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.beneficio_total_eur).toBe(25);
    expect(stats.kpis.compras_total_eur).toBe(100);
    expect(stats.kpis.stock_pendiente_count).toBe(1);
  });

  it('topProducts con pack multi-item: prorratea revenue por unidad entre los items', () => {
    const buyA = buysRepo.create(validBuy({ product_name: 'A', purchase_cost: 10, quantity: 5 }));
    const buyB = buysRepo.create(validBuy({ product_name: 'B', purchase_cost: 6, quantity: 5 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 30,
        associated_costs: 0,
        items: [
          { buy_id: buyA.id, quantity: 2 },
          { buy_id: buyB.id, quantity: 1 },
        ],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topProducts).toHaveLength(2);
    const a = stats.topProducts.find((p) => p.product_name === 'A')!;
    const b = stats.topProducts.find((p) => p.product_name === 'B')!;
    expect(a.total_revenue).toBe(20);
    expect(b.total_revenue).toBe(10);
    expect(a.total_profit).toBe(16);
    expect(b.total_profit).toBeCloseTo(8.8, 2);
  });

  it('beneficio_total_eur con pack multi-item: suma beneficio de cada venta', () => {
    const buyA = buysRepo.create(validBuy({ product_name: 'A', purchase_cost: 10, quantity: 5 }));
    const buyB = buysRepo.create(validBuy({ product_name: 'B', purchase_cost: 6, quantity: 5 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 30,
        associated_costs: 3,
        items: [
          { buy_id: buyA.id, quantity: 2 },
          { buy_id: buyB.id, quantity: 1 },
        ],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.kpis.beneficio_total_eur).toBeCloseTo(21.8, 2);
  });

  it('cashFlowByMonth: solo compras en el mes, sin ventas → compras > 0, beneficio = 0, resultado = -compras', () => {
    buysRepo.create(
      validBuy({
        product_name: 'Lote',
        purchase_cost: 100,
        associated_costs: 0,
        purchase_date: todayLocalDate(),
      }),
    );

    const stats = soldsRepo.statsDashboard();
    const currentMonth = stats.cashFlowByMonth[11]!;
    expect(currentMonth.compras).toBe(100);
    expect(currentMonth.ingresos).toBe(0);
    expect(currentMonth.beneficio).toBe(0);
    expect(currentMonth.resultado).toBe(-100);
  });

  it('cashFlowByMonth: solo ventas en el mes (sin buys nuevos) → compras = 0, beneficio > 0', () => {
    const buy = buysRepo.create(
      validBuy({
        product_name: 'Lote',
        purchase_cost: 50,
        quantity: 5,
        purchase_date: dateMonthsAgo(2),
      }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 80,
        associated_costs: 0,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    const currentMonth = stats.cashFlowByMonth[11]!;
    expect(currentMonth.compras).toBe(0);
    expect(currentMonth.ingresos).toBe(80);
    expect(currentMonth.beneficio).toBe(70);
    expect(currentMonth.resultado).toBe(70);
  });

  it('cashFlowByMonth: mes con buy y venta contabiliza compras (incluye asociados de solds)', () => {
    const buy = buysRepo.create(
      validBuy({
        product_name: 'Prod',
        purchase_cost: 30,
        quantity: 10,
        associated_costs: 5,
        purchase_date: todayLocalDate(),
      }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 50,
        associated_costs: 2,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    const currentMonth = stats.cashFlowByMonth[11]!;
    expect(currentMonth.compras).toBe(37);
    expect(currentMonth.ingresos).toBe(50);
    expect(currentMonth.beneficio).toBe(44.5);
    expect(currentMonth.resultado).toBe(9.5);
  });

  it('cashFlowByMonth: resultado = profit de las ventas - gasto en compras del mes', () => {
    const buy = buysRepo.create(
      validBuy({
        product_name: 'Prod',
        purchase_cost: 30,
        quantity: 10,
        associated_costs: 5,
        purchase_date: todayLocalDate(),
      }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 50,
        associated_costs: 2,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    const currentMonth = stats.cashFlowByMonth[11]!;
    expect(currentMonth.ingresos).toBe(50);
    expect(currentMonth.beneficio).toBe(44.5);
    expect(currentMonth.resultado).toBe(9.5);
  });

  it('cashFlowByMonth: meses sin actividad se rellenan con 0', () => {
    const buy = buysRepo.create(
      validBuy({
        product_name: 'X',
        purchase_cost: 10,
        quantity: 5,
        purchase_date: todayLocalDate(),
      }),
    );
    const customer = customersRepo.create(validCustomer({ name: 'C' }));
    soldsRepo.createManyWithStockCheck(
      validSold({
        customer_id: customer.id,
        sale_price: 15,
        sold_at: todayLocalDate(),
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const stats = soldsRepo.statsDashboard();
    for (let i = 0; i < 11; i++) {
      expect(stats.cashFlowByMonth[i]).toMatchObject({
        compras: 0,
        ingresos: 0,
        beneficio: 0,
        resultado: 0,
      });
    }
  });
});
