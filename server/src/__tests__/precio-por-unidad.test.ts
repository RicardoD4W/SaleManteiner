import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createMetricsRepo } from '../repo/metrics-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { CreateBuyInput } from '../schemas/buys.js';
import { CreateSoldInput } from '../schemas/solds.js';

describe('la semántica del precio por unidad', () => {
  let db: Database;
  let buys: ReturnType<typeof createBuysRepo>;
  let solds: ReturnType<typeof createSoldsRepo>;
  let customers: ReturnType<typeof createCustomersRepo>;
  let metrics: ReturnType<typeof createMetricsRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buys = createBuysRepo(db);
    solds = createSoldsRepo(db);
    customers = createCustomersRepo(db);
    metrics = createMetricsRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('el total del lote se deriva del precio por unidad', () => {
    const buy = buys.create(
      CreateBuyInput.parse({ product_name: 'Camiseta', purchase_cost: 5, quantity: 4 }),
    );

    expect(buy.total_cost).toBe(20);
  });

  it('las compras totales siguen significando el total pagado', () => {
    buys.create(CreateBuyInput.parse({ product_name: 'A', purchase_cost: 100, quantity: 2 }));
    buys.create(CreateBuyInput.parse({ product_name: 'B', purchase_cost: 50, quantity: 4 }));

    expect(solds.statsDashboard().kpis.compras_total_eur).toBe(400);
  });

  it('el valor del stock pendiente usa el precio unitario y prorratea los asociados', () => {
    buys.create(
      CreateBuyInput.parse({
        product_name: 'A',
        purchase_cost: 10,
        quantity: 4,
        associated_costs: 8,
      }),
    );

    expect(metrics.stats().kpis.stock_coste_total_eur).toBe(48);
  });

  it('el prorrateo de los gastos asociados usa el mismo redondeo que las vistas', () => {
    buys.create(
      CreateBuyInput.parse({
        product_name: 'A',
        purchase_cost: 10,
        quantity: 3,
        associated_costs: 1,
      }),
    );

    expect(metrics.stats().kpis.stock_coste_total_eur).toBe(30.99);
  });

  it('el coste de la venta sale de la cantidad vendida por el precio unitario', () => {
    const buy = buys.create(
      CreateBuyInput.parse({ product_name: 'Camiseta', purchase_cost: 10, quantity: 4 }),
    );
    const customer = customers.create({ name: 'Ana' });

    const sold = solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: customer.id,
        sale_price: 50,
        items: [{ buy_id: buy.id, quantity: 2 }],
      }),
    );

    const detail = solds.getByIdWithItems(sold.id)!;
    expect(detail.items[0].unit_cost).toBe(10);

    const conBeneficio = solds.listWithProfit().find((s) => s.id === sold.id)!;
    expect(conBeneficio.profit).toBe(30);
  });
});
