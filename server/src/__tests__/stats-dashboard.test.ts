/**
 * Tests de `statsDashboard()` (Fase 5).
 *
 * Cobertura:
 *  - BD vacía: KPIs en 0, 12 meses con revenue=0, sin top products.
 *  - Una venta del mes actual: aparece en el último slot de revenueByMonth;
 *    aparece en topProducts con count=1.
 *  - Meses sin ventas en BD: la serie tiene 12 puntos con ceros (relleno
 *    generado en TS por `lastNMonths`).
 *  - topProducts: ordena por revenue descendente, limita a 10, agrupa por
 *    product_name (mismo nombre vendido N veces → 1 entrada con times_sold=N).
 *  - Ventas no vendidas NO se cuentan en revenue ni en top.
 *  - Profit mensual = revenue - cost - associated.
 *
 * Las fechas se generan con `new Date().toISOString()` para mantener el mes
 * actual siempre dentro del rango de 12 meses, independientemente del día
 * en que se corra el test (determinista entre ejecuciones).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createSalesRepo, type SalesRepo } from '../repo/sales-repo.js';
import {
  CreateSaleInput as CreateSaleInputSchema,
  type CreateSaleInput,
} from '../schemas/sales.js';

function todayIso(): string {
  return new Date().toISOString();
}

/**
 * Crea el ISO de una fecha con `monthsAgo` meses calendario atrás, día 15
 * a mediodía (para evitar fechas ambiguas en cambios de zona horaria).
 * Usado para verificar que ventas fuera del mes actual caen en los slots
 * correctos de `revenueByMonth`.
 */
function isoMonthsAgo(monthsAgo: number, dayOfMonth = 15): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dayOfMonth, 12, 0, 0);
  return d.toISOString();
}

/**
 * Overrides permisivos (cualquier subset de claves con valor `unknown`):
 * los callers pasan números planos / fechas como strings, y Zod aplica
 * los brands `Cents` / `RowId` cuando parseamos.
 */
type PermissiveCreate = { [K in keyof CreateSaleInput]?: unknown };

function validCreate(overrides: PermissiveCreate = {}): CreateSaleInput {
  return CreateSaleInputSchema.parse({
    product_name: 'X',
    ...overrides,
  });
}

describe('statsDashboard (Fase 5)', () => {
  let db: Database;
  let repo: SalesRepo;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createSalesRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('BD vacía: KPIs en cero, 12 meses con revenue=0, sin top products', () => {
    const stats = repo.statsDashboard();
    expect(stats.kpis.total).toBe(0);
    expect(stats.kpis.sold).toBe(0);
    expect(stats.kpis.revenue_cents).toBe(0);
    expect(stats.kpis.net_profit_cents).toBe(0);
    expect(stats.revenueByMonth).toHaveLength(12);
    stats.revenueByMonth.forEach((m) => {
      expect(m.revenue_cents).toBe(0);
      expect(m.profit_cents).toBe(0);
    });
    expect(stats.topProducts).toHaveLength(0);
  });

  it('serie de 12 meses está en formato YYYY-MM y ordenada ascendente', () => {
    const stats = repo.statsDashboard();
    const months = stats.revenueByMonth.map((m) => m.month);
    expect(months).toHaveLength(12);
    for (const month of months) {
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    }
    // Consecutivos y ordenados.
    for (let i = 1; i < months.length; i++) {
      expect(months[i]! > months[i - 1]!).toBe(true);
    }
  });

  it('una venta del mes actual aparece en el último slot y en top', () => {
    repo.create(
      validCreate({
        product_name: 'iPhone',
        cost_cents: 10000,
        price_cents: 15000,
        sold: true,
        sold_at: todayIso(),
      }),
    );

    const stats = repo.statsDashboard();
    expect(stats.kpis.total).toBe(1);
    expect(stats.kpis.sold).toBe(1);
    expect(stats.kpis.revenue_cents).toBe(15000);
    expect(stats.kpis.net_profit_cents).toBe(5000);

    const currentMonth = stats.revenueByMonth[11]!; // último = mes actual
    expect(currentMonth.revenue_cents).toBe(15000);
    expect(currentMonth.profit_cents).toBe(5000);

    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toEqual({
      product_name: 'iPhone',
      times_sold: 1,
      total_revenue_cents: 15000,
      total_profit_cents: 5000,
    });
  });

  it('profit mensual = revenue - cost - associated', () => {
    repo.create(
      validCreate({
        product_name: 'X',
        cost_cents: 100,
        price_cents: 500,
        associated_costs_cents: 100,
        sold: true,
        sold_at: todayIso(),
      }),
    );

    const stats = repo.statsDashboard();
    const current = stats.revenueByMonth[11]!;
    expect(current.revenue_cents).toBe(500);
    expect(current.profit_cents).toBe(300); // 500 - 100 - 100
  });

  it('mismo producto vendido N veces aparece como 1 entrada con times_sold=N', () => {
    for (let i = 0; i < 3; i++) {
      repo.create(
        validCreate({
          product_name: 'Repetido',
          cost_cents: 100,
          price_cents: 500,
          sold: true,
          sold_at: todayIso(),
        }),
      );
    }

    const stats = repo.statsDashboard();
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]).toEqual({
      product_name: 'Repetido',
      times_sold: 3,
      total_revenue_cents: 1500,
      total_profit_cents: 1200, // 3 * (500 - 100) = 1200
    });
  });

  it('topProducts ordena por revenue descendente', () => {
    repo.create(
      validCreate({
        product_name: 'A',
        cost_cents: 100,
        price_cents: 1000,
        sold: true,
        sold_at: todayIso(),
      }),
    );
    repo.create(
      validCreate({
        product_name: 'B',
        cost_cents: 100,
        price_cents: 5000,
        sold: true,
        sold_at: todayIso(),
      }),
    );
    repo.create(
      validCreate({
        product_name: 'C',
        cost_cents: 100,
        price_cents: 2000,
        sold: true,
        sold_at: todayIso(),
      }),
    );

    const stats = repo.statsDashboard();
    expect(stats.topProducts.map((p) => p.product_name)).toEqual(['B', 'C', 'A']);
  });

  it('ventas no vendidas NO se cuentan en revenue ni en top', () => {
    repo.create(
      validCreate({
        product_name: 'No vendida',
        cost_cents: 100,
        price_cents: 9999,
      }),
    );
    repo.create(
      validCreate({
        product_name: 'Vendida',
        cost_cents: 100,
        price_cents: 500,
        sold: true,
        sold_at: todayIso(),
      }),
    );

    const stats = repo.statsDashboard();
    expect(stats.kpis.total).toBe(2); // ambas cuentan para total
    expect(stats.kpis.sold).toBe(1);
    expect(stats.kpis.revenue_cents).toBe(500);
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0]!.product_name).toBe('Vendida');
  });

  it('distintas ventas del mismo mes se suman en revenueByMonth', () => {
    repo.create(
      validCreate({
        product_name: 'A',
        cost_cents: 100,
        price_cents: 200,
        sold: true,
        sold_at: todayIso(),
      }),
    );
    repo.create(
      validCreate({
        product_name: 'B',
        cost_cents: 100,
        price_cents: 300,
        sold: true,
        sold_at: todayIso(),
      }),
    );

    const stats = repo.statsDashboard();
    const current = stats.revenueByMonth[11]!;
    expect(current.revenue_cents).toBe(500);
    expect(current.profit_cents).toBe(300); // 500 - 200
  });

  it('una venta de hace 5 meses cae en el slot correcto (relleno de meses vacíos)', () => {
    // Hace 5 meses calendario (siempre dentro del rango de 12).
    const fiveMonthsAgo = isoMonthsAgo(5);
    repo.create(
      validCreate({
        product_name: 'X',
        cost_cents: 100,
        price_cents: 700,
        sold: true,
        sold_at: fiveMonthsAgo,
      }),
    );

    const stats = repo.statsDashboard();
    // El slot del mes de hace 5 (índice 6 = 12 - 5 - 1) debe tener revenue.
    const targetSlot = stats.revenueByMonth[6]!;
    expect(targetSlot.revenue_cents).toBe(700);
    expect(targetSlot.profit_cents).toBe(600);

    // El resto de los slots sigue en cero.
    const otherSlots = stats.revenueByMonth.filter((_, i) => i !== 6);
    otherSlots.forEach((m) => {
      expect(m.revenue_cents).toBe(0);
      expect(m.profit_cents).toBe(0);
    });
  });
});
