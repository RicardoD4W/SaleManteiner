import type { Database } from 'better-sqlite3';
import { round2 } from '../lib/round.js';

export interface MonthMetrics {
  month: string;
  ingresos: number;
  beneficio: number;
  gastos: number;
  resultado: number;
  margen_pct: number;
  ventas: number;
}

export interface MetricsVariations {
  ingresos_pct: number | null;
  beneficio_pct: number | null;
  gastos_pct: number | null;
  resultado_pct: number | null;
  margen_puntos: number | null;
}

export interface MetricsStats {
  kpis: {
    ingresos_total_eur: number;
    beneficio_total_eur: number;
    gastos_total_eur: number;
    beneficio_neto_eur: number;
    margen_pct: number;
    gastos_sobre_ingresos_pct: number;
    ticket_medio_eur: number;
    beneficio_medio_venta_eur: number;
    ventas_count: number;
    clientes_count: number;
    clientes_con_deuda: number;
    deuda_total_eur: number;
    stock_pendiente_count: number;
    stock_coste_total_eur: number;
  };
  mes_actual: MonthMetrics;
  mes_anterior: MonthMetrics;
  variaciones: MetricsVariations | null;
  margen_productos: Array<{
    product_id: number;
    product_name: string;
    unidades: number;
    ingresos: number;
    beneficio: number;
    margen_pct: number;
  }>;
  deudores: Array<{
    customer_id: number;
    customer_name: string;
    ventas: number;
    deuda: number;
  }>;
  gastos_categoria: Array<{
    category_id: number;
    name: string;
    total: number;
    pct: number;
  }>;
}

export interface MetricsRepo {
  stats(): MetricsStats;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return monthKey(date);
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round2((numerator / denominator) * 100);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

export function createMetricsRepo(db: Database): MetricsRepo {
  const salesTotalsStmt = db.prepare(
    `SELECT COALESCE(SUM(sale_price), 0) AS ingresos,
            COUNT(*) AS ventas,
            COALESCE(SUM(sale_price - paid_amount), 0) AS deuda
     FROM solds`,
  );
  const profitTotalStmt = db.prepare(`SELECT COALESCE(SUM(profit), 0) AS total FROM v_sold_costs`);
  const expensesTotalStmt = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses`);
  const customersCountStmt = db.prepare(`SELECT COUNT(*) AS cnt FROM customers`);
  const debtorsCountStmt = db.prepare(
    `SELECT COUNT(*) AS cnt FROM (
       SELECT customer_id FROM solds GROUP BY customer_id HAVING SUM(sale_price - paid_amount) > 0
     )`,
  );
  const stockStmt = db.prepare(
    `SELECT COUNT(*) AS cnt,
            COALESCE(SUM(pendiente * coste_unitario), 0) AS coste
     FROM (
       SELECT b.quantity - COALESCE(
                (SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0
              ) AS pendiente,
              (b.purchase_cost + b.associated_costs) * 1.0 / b.quantity AS coste_unitario
       FROM buys b
     )
     WHERE pendiente > 0`,
  );
  const monthSalesStmt = db.prepare(
    `SELECT COALESCE(SUM(sale_price), 0) AS ingresos, COUNT(*) AS ventas
     FROM solds
     WHERE sold_at IS NOT NULL AND strftime('%Y-%m', sold_at) = ?`,
  );
  const monthProfitStmt = db.prepare(
    `SELECT COALESCE(SUM(c.profit), 0) AS total
     FROM solds s
     JOIN v_sold_costs c ON c.sold_id = s.id
     WHERE s.sold_at IS NOT NULL AND strftime('%Y-%m', s.sold_at) = ?`,
  );
  const monthExpensesStmt = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE strftime('%Y-%m', expense_date) = ?`,
  );
  const productMarginsStmt = db.prepare(
    `SELECT ic.buy_id AS product_id,
            ic.product_name,
            SUM(ic.quantity) AS unidades,
            SUM(ic.quantity * (s.sale_price * 1.0 / st.total_qty)) AS ingresos,
            SUM(ic.quantity * (s.sale_price - s.associated_costs) * 1.0 / st.total_qty)
              - SUM(ic.quantity * ic.unit_cost)
              - SUM(ic.quantity * ic.unit_assoc) AS beneficio
     FROM v_item_costs ic
     JOIN solds s ON s.id = ic.sold_id
     JOIN (
       SELECT sold_id, SUM(quantity) AS total_qty
       FROM sale_items
       GROUP BY sold_id
     ) st ON st.sold_id = s.id
     GROUP BY ic.buy_id
     ORDER BY ingresos DESC
     LIMIT 10`,
  );
  const debtorsStmt = db.prepare(
    `SELECT c.id AS customer_id,
            c.name AS customer_name,
            COUNT(s.id) AS ventas,
            SUM(s.sale_price - s.paid_amount) AS deuda
     FROM customers c
     JOIN solds s ON s.customer_id = c.id
     GROUP BY c.id
     HAVING deuda > 0
     ORDER BY deuda DESC
     LIMIT 10`,
  );
  const expensesByCategoryStmt = db.prepare(
    `SELECT ec.id AS category_id,
            ec.name,
            COALESCE(SUM(e.amount), 0) AS total
     FROM expense_categories ec
     JOIN expenses e ON e.category_id = ec.id
     GROUP BY ec.id
     ORDER BY total DESC`,
  );

  function monthMetrics(month: string): MonthMetrics {
    const sales = monthSalesStmt.get(month) as { ingresos: number; ventas: number };
    const profit = monthProfitStmt.get(month) as { total: number };
    const expenses = monthExpensesStmt.get(month) as { total: number };

    const ingresos = round2(sales.ingresos);
    const beneficio = round2(profit.total);
    const gastos = round2(expenses.total);

    return {
      month,
      ingresos,
      beneficio,
      gastos,
      resultado: round2(beneficio - gastos),
      margen_pct: percent(beneficio, ingresos),
      ventas: sales.ventas,
    };
  }

  function stats(): MetricsStats {
    const sales = salesTotalsStmt.get() as { ingresos: number; ventas: number; deuda: number };
    const profit = profitTotalStmt.get() as { total: number };
    const expenses = expensesTotalStmt.get() as { total: number };
    const customers = customersCountStmt.get() as { cnt: number };
    const debtors = debtorsCountStmt.get() as { cnt: number };
    const stock = stockStmt.get() as { cnt: number; coste: number };

    const ingresosTotal = round2(sales.ingresos);
    const beneficioTotal = round2(profit.total);
    const gastosTotal = round2(expenses.total);
    const ventas = sales.ventas;

    const currentMonth = monthKey(new Date());
    const previousMonth = shiftMonth(currentMonth, -1);
    const mesActual = monthMetrics(currentMonth);
    const mesAnterior = monthMetrics(previousMonth);

    const hayBaseComparativa = mesAnterior.ventas > 0 || mesAnterior.gastos > 0;
    const variaciones: MetricsVariations | null = hayBaseComparativa
      ? {
          ingresos_pct: pctChange(mesActual.ingresos, mesAnterior.ingresos),
          beneficio_pct: pctChange(mesActual.beneficio, mesAnterior.beneficio),
          gastos_pct: pctChange(mesActual.gastos, mesAnterior.gastos),
          resultado_pct: pctChange(mesActual.resultado, mesAnterior.resultado),
          margen_puntos: round2(mesActual.margen_pct - mesAnterior.margen_pct),
        }
      : null;

    const marginProducts = productMarginsStmt.all() as Array<{
      product_id: number;
      product_name: string;
      unidades: number;
      ingresos: number;
      beneficio: number;
    }>;

    const debtorsRows = debtorsStmt.all() as Array<{
      customer_id: number;
      customer_name: string;
      ventas: number;
      deuda: number;
    }>;

    const categoryRows = expensesByCategoryStmt.all() as Array<{
      category_id: number;
      name: string;
      total: number;
    }>;

    return {
      kpis: {
        ingresos_total_eur: ingresosTotal,
        beneficio_total_eur: beneficioTotal,
        gastos_total_eur: gastosTotal,
        beneficio_neto_eur: round2(beneficioTotal - gastosTotal),
        margen_pct: percent(beneficioTotal, ingresosTotal),
        gastos_sobre_ingresos_pct: percent(gastosTotal, ingresosTotal),
        ticket_medio_eur: ventas > 0 ? round2(ingresosTotal / ventas) : 0,
        beneficio_medio_venta_eur: ventas > 0 ? round2(beneficioTotal / ventas) : 0,
        ventas_count: ventas,
        clientes_count: customers.cnt,
        clientes_con_deuda: debtors.cnt,
        deuda_total_eur: round2(sales.deuda),
        stock_pendiente_count: stock.cnt,
        stock_coste_total_eur: round2(stock.coste),
      },
      mes_actual: mesActual,
      mes_anterior: mesAnterior,
      variaciones,
      margen_productos: marginProducts.map((row) => {
        const ingresos = round2(row.ingresos);
        const beneficio = round2(row.beneficio);
        return {
          product_id: row.product_id,
          product_name: row.product_name,
          unidades: row.unidades,
          ingresos,
          beneficio,
          margen_pct: percent(beneficio, ingresos),
        };
      }),
      deudores: debtorsRows.map((row) => ({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        ventas: row.ventas,
        deuda: round2(row.deuda),
      })),
      gastos_categoria: categoryRows.map((row) => ({
        category_id: row.category_id,
        name: row.name,
        total: round2(row.total),
        pct: percent(round2(row.total), gastosTotal),
      })),
    };
  }

  return { stats };
}
