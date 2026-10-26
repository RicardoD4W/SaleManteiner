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

const OLD_PROFIT_SQL = `
  SELECT s.id AS sold_id,
         s.sale_price - s.associated_costs
           - COALESCE(SUM(si.quantity * ROUND(b.purchase_cost / b.quantity, 2)), 0)
           - COALESCE(SUM(si.quantity * ROUND(b.associated_costs / b.quantity, 2)), 0) AS profit
  FROM solds s
  LEFT JOIN sale_items si ON si.sold_id = s.id
  LEFT JOIN buys b ON b.id = si.buy_id
  GROUP BY s.id
`;

describe('las vistas de las cifras (la fuente de la verdad)', () => {
  let db: Database;
  let buys: ReturnType<typeof createBuysRepo>;
  let solds: ReturnType<typeof createSoldsRepo>;
  let customers: ReturnType<typeof createCustomersRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buys = createBuysRepo(db);
    solds = createSoldsRepo(db);
    customers = createCustomersRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  function sembrar() {
    const ana = customers.create(CreateCustomerInput.parse({ name: 'Ana' }));
    const bruno = customers.create(CreateCustomerInput.parse({ name: 'Bruno' }));

    const empates = buys.create(
      CreateBuyInput.parse({ product_name: 'Empate', purchase_cost: 0.7, quantity: 4 }),
    );
    const normal = buys.create(
      CreateBuyInput.parse({
        product_name: 'Normal',
        purchase_cost: 45.5,
        quantity: 6,
        associated_costs: 3.2,
      }),
    );
    const caro = buys.create(
      CreateBuyInput.parse({ product_name: 'Caro', purchase_cost: 320, quantity: 2 }),
    );

    solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: ana.id,
        sale_price: 250,
        associated_costs: 12,
        items: [
          { buy_id: empates.id, quantity: 1 },
          { buy_id: normal.id, quantity: 2 },
        ],
      }),
    );
    solds.createManyWithStockCheck(
      CreateSoldInput.parse({
        customer_id: bruno.id,
        sale_price: 90,
        associated_costs: 40,
        items: [{ buy_id: caro.id, quantity: 1 }],
      }),
    );
  }

  it('el beneficio de la vista es el mismo que daba la fórmula de antes', () => {
    sembrar();

    const antes = db.prepare(OLD_PROFIT_SQL).all() as Array<{ sold_id: number; profit: number }>;
    const vista = db
      .prepare('SELECT sold_id, profit FROM v_sold_costs ORDER BY sold_id')
      .all() as Array<{
      sold_id: number;
      profit: number;
    }>;

    expect(vista).toHaveLength(antes.length);
    for (const row of antes) {
      const enVista = vista.find((v) => v.sold_id === row.sold_id);
      expect(enVista?.profit).toBeCloseTo(row.profit, 10);
    }
  });

  it('la lista con beneficio y la vista dicen lo mismo', () => {
    sembrar();

    const lista = solds.listWithProfit();
    const vista = db.prepare('SELECT sold_id, profit FROM v_sold_costs').all() as Array<{
      sold_id: number;
      profit: number;
    }>;

    expect(lista).toHaveLength(vista.length);
    for (const sold of lista) {
      const enVista = vista.find((v) => v.sold_id === sold.id);
      expect(sold.profit).toBeCloseTo(enVista?.profit ?? 0, 10);
    }
  });

  it('el total del dashboard es la suma de los beneficios de la vista', () => {
    sembrar();

    const stats = solds.statsDashboard();
    const total = db
      .prepare('SELECT COALESCE(SUM(profit), 0) AS total FROM v_sold_costs')
      .get() as { total: number };

    expect(stats.kpis.beneficio_total_eur).toBeCloseTo(total.total, 10);
  });

  it('la vista prorratea el coste de compra por unidad con el ROUND de SQLite', () => {
    sembrar();

    const items = db
      .prepare(
        `SELECT sold_id, buy_id, quantity, unit_cost, unit_assoc FROM v_item_costs ORDER BY sold_id, buy_id`,
      )
      .all() as Array<{
      sold_id: number;
      buy_id: number;
      quantity: number;
      unit_cost: number;
      unit_assoc: number;
    }>;

    const baseline = db.prepare(
      `SELECT b.id AS buy_id,
              ROUND(b.purchase_cost / b.quantity, 2) AS unit_cost,
              ROUND(b.associated_costs / b.quantity, 2) AS unit_assoc
       FROM buys b
       WHERE b.id = ?`,
    );

    for (const item of items) {
      const esperado = baseline.get(item.buy_id) as { unit_cost: number; unit_assoc: number };
      expect(item.unit_cost).toBe(esperado.unit_cost);
      expect(item.unit_assoc).toBe(esperado.unit_assoc);
    }
  });
});
