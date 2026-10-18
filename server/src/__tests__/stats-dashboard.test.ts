/**
 * Tests del dashboard stats del nuevo modelo (S11 del feature).
 *
 * Cobertura:
 *  - BD vacía: KPIs en 0, 12 meses con revenue=0, sin top products/buyers.
 *  - revenueByMonth: últimos 12 meses, formato YYYY-MM, ordenado ascendente.
 *  - Meses sin ventas: relleno con 0 (incluye mes actual).
 *  - topProducts: ordena por total_revenue DESC, top 10, times_sold por buy.
 *  - topBuyers: ordena por total_gastado DESC, top 10.
 *  - KPIs: compras_total_eur, ventas_total_eur, beneficio_total_eur, stock_pendiente_count.
 */
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

function validBuy(overrides: Record<string, unknown> = {}): ReturnType<typeof CreateBuyInput.parse> {
  return CreateBuyInput.parse({ product_name: 'X', purchase_cost: 0, quantity: 1, ...overrides });
}

function validSold(overrides: Record<string, unknown> = {}): ReturnType<typeof CreateSoldInput.parse> {
  return CreateSoldInput.parse({
    customer_id: 1,
    sale_price: 0,
    items: [{ buy_id: 1, quantity: 1 }],
    ...overrides,
  });
}

function validCustomer(overrides: Record<string, unknown> = {}): ReturnType<typeof CreateCustomerInput.parse> {
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
    expect(stats.revenueByMonth).toHaveLength(12);
    stats.revenueByMonth.forEach((m) => {
      expect(m.revenue).toBe(0);
      expect(m.profit).toBe(0);
    });
    expect(stats.topProducts).toHaveLength(0);
    expect(stats.topBuyers).toHaveLength(0);
  });

  it('revenueByMonth: formato YYYY-MM, ordenado ascendente, 12 puntos', () => {
    const stats = soldsRepo.statsDashboard();
    const months = stats.revenueByMonth.map((m) => m.month);
    expect(months).toHaveLength(12);
    for (const month of months) {
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    }
    for (let i = 1; i < months.length; i++) {
      expect(months[i]! > months[i - 1]!).toBe(true);
    }
  });

  it('una venta del mes actual aparece en el último slot y en topProducts', () => {
    const customer = customersRepo.create(validCustomer({ name: 'Juan' }));
    const buy = buysRepo.create(validBuy({ product_name: 'Funda', purchase_cost: 5, quantity: 10 }));

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
    const currentMonth = stats.revenueByMonth[11]!;
    expect(currentMonth.revenue).toBe(8);
    expect(currentMonth.profit).toBe(7); // revenue - associated_costs

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
    expect(stats.kpis.compras_total_eur).toBe(165); // 100+10 + 50+5
  });

  it('stock_pendiente_count cuenta buys con disponibles > 0', () => {
    // Buy con 3 unidades
    const buy = buysRepo.create(validBuy({ product_name: 'X', purchase_cost: 30, quantity: 3 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    // Vender 2 → queda 1 disponible
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

  it('mismo buy vendido varias veces: times_sold refleja count de sale_items', () => {
    const customer = customersRepo.create(validCustomer({ name: 'C' }));
    const buy = buysRepo.create(validBuy({ product_name: 'Pack', purchase_cost: 60, quantity: 5 }));

    // Vender 1 unidad
    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: customer.id, sale_price: 20, items: [{ buy_id: buy.id, quantity: 1 }] }),
    );
    // Vender 1 unidad más
    soldsRepo.createManyWithStockCheck(
      validSold({ customer_id: customer.id, sale_price: 22, items: [{ buy_id: buy.id, quantity: 1 }] }),
    );

    const stats = soldsRepo.statsDashboard();
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toMatchObject({
      product_name: 'Pack',
      times_sold: 2,
    });
  });

  it('beneficio_total_eur: NO resta el coste de compras sin vender (solo COGS)', () => {
    // Buy 20 unidades por 100€ (cost/unit = 5€). Vender solo 5 unidades.
    const buy = buysRepo.create(validBuy({ product_name: 'Funda', purchase_cost: 100, quantity: 20 }));
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
    // beneficio = sale_price - associated_costs - COGS = 50 - 0 - (5 * 5) = 25
    // NO se resta el coste total de la compra (100€) porque 15 unidades siguen en stock.
    expect(stats.kpis.beneficio_total_eur).toBe(25);
    // compras_total_eur SÍ incluye toda la inversión (incluyendo stock pendiente).
    expect(stats.kpis.compras_total_eur).toBe(100);
    // stock_pendiente_count = 1 (la compra de 20 unidades, con 5 vendidas, tiene 15 disponibles).
    expect(stats.kpis.stock_pendiente_count).toBe(1);
  });

  it('topProducts con pack multi-item: prorratea revenue por unidad entre los items', () => {
    // Pack: vender 2 items de A + 1 item de B en una sola venta de 30€.
    // A debería tener 20€ de revenue (2/3 de 30) y B debería tener 10€ (1/3 de 30).
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
    // Revenue prorrateado: 2/3 * 30 = 20, 1/3 * 30 = 10
    expect(a.total_revenue).toBe(20);
    expect(b.total_revenue).toBe(10);
    // Profit A = 20 - 0 - (2 * 2) - 0 = 16 (cost/unit = 10/5 = 2)
    expect(a.total_profit).toBe(16);
    // Profit B = 10 - 0 - (1 * 1.2) - 0 = 8.8 (cost/unit = 6/5 = 1.2)
    expect(b.total_profit).toBeCloseTo(8.8, 2);
  });

  it('beneficio_total_eur con pack multi-item: suma beneficio de cada venta', () => {
    const buyA = buysRepo.create(validBuy({ product_name: 'A', purchase_cost: 10, quantity: 5 }));
    const buyB = buysRepo.create(validBuy({ product_name: 'B', purchase_cost: 6, quantity: 5 }));
    const customer = customersRepo.create(validCustomer({ name: 'C' }));

    // Pack: 2 de A + 1 de B, venta 30€, gastos 3€.
    // COGS: 2*2 + 1*1.2 = 5.2. Beneficio: 30 - 3 - 5.2 = 21.8
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
});
