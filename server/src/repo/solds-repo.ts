import type { Database } from 'better-sqlite3';
import { round2 } from '../lib/round.js';
import { definedOnly } from '../lib/defined-only.js';
import type { DateRange } from './types.js';
import type { Sold } from '../schemas/solds.js';
import type {
  CreateSoldInput,
  SaleItemOutput,
  SoldWithItems,
  UpdateSoldInput,
} from '../schemas/solds.js';

interface SoldRow {
  id: number;
  customer_id: number;
  sale_price: number;
  associated_costs: number;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
}

interface SaleItemRow {
  buy_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  unit_assoc: number;
}

function rowToSold(row: SoldRow): Sold {
  return {
    id: row.id,
    customer_id: row.customer_id,
    sale_price: row.sale_price,
    associated_costs: row.associated_costs,
    sold_at: row.sold_at,
    notes: row.notes,
    created_at: row.created_at,
  };
}

export interface SoldListFilters {
  customerId?: number;
  dateRange?: DateRange;
}

export interface StockInsufficientItem {
  buy_id: number;
  product_name: string;
  disponibles: number;
  solicitado: number;
}

export class StockInsufficientError extends Error {
  readonly error = 'Stock insuficiente';
  readonly items: StockInsufficientItem[];

  constructor(items: StockInsufficientItem[]) {
    super('Stock insuficiente');
    this.name = 'StockInsufficientError';
    this.items = items;
  }
}

export interface SoldsRepo {
  createManyWithStockCheck(input: CreateSoldInput): Sold;
  getById(id: number): Sold | null;
  getByIdWithItems(id: number): SoldWithItems | null;
  list(filters?: SoldListFilters): Sold[];
  listWithProfit(filters?: SoldListFilters): SoldWithProfit[];
  update(id: number, input: UpdateSoldInput): Sold | null;
  remove(id: number): boolean;
  statsDashboard(): DashboardStats;
}

export interface SoldWithProfit extends Sold {
  profit: number;
  items: SaleItemOutput[];
}

export interface DashboardStats {
  kpis: {
    compras_total_eur: number;
    ventas_total_eur: number;
    beneficio_total_eur: number;
    stock_pendiente_count: number;
  };
  cashFlowByMonth: Array<{
    month: string;
    ingresos: number;
    compras: number;
    beneficio: number;
    resultado: number;
  }>;
  topProducts: Array<{
    product_id: number;
    product_name: string;
    times_sold: number;
    total_revenue: number;
    total_profit: number;
  }>;
  topBuyers: Array<{
    customer_id: number;
    customer_name: string;
    ventas: number;
    total_gastado: number;
  }>;
}

function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push(month);
  }
  return result;
}

export function createSoldsRepo(db: Database): SoldsRepo {
  const insertSoldStmt = db.prepare(`
    INSERT INTO solds (customer_id, sale_price, associated_costs, sold_at, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertItemStmt = db.prepare(`
    INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)
  `);
  const getStmt = db.prepare('SELECT * FROM solds WHERE id = ?');
  const deleteStmt = db.prepare('DELETE FROM solds WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE solds SET
      customer_id = ?,
      sale_price = ?,
      associated_costs = ?,
      sold_at = ?,
      notes = ?
    WHERE id = ?
  `);

  function createManyWithStockCheck(input: CreateSoldInput): Sold {
    return db.transaction(() => {
      const now = new Date().toISOString();

      const stockErrors: StockInsufficientItem[] = [];

      for (const item of input.items) {
        const rows = db
          .prepare(
            `SELECT b.id AS buy_id, b.product_name,
              (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
             FROM buys b WHERE b.id = ?`,
          )
          .get(item.buy_id) as
          { buy_id: number; product_name: string; disponibles: number } | undefined;

        if (!rows) {
          stockErrors.push({
            buy_id: item.buy_id,
            product_name: `id:${item.buy_id}`,
            disponibles: 0,
            solicitado: item.quantity,
          });
        } else if (rows.disponibles < item.quantity) {
          stockErrors.push({
            buy_id: item.buy_id,
            product_name: rows.product_name,
            disponibles: rows.disponibles,
            solicitado: item.quantity,
          });
        }
      }

      if (stockErrors.length > 0) {
        throw new StockInsufficientError(stockErrors);
      }

      const soldResult = insertSoldStmt.run(
        input.customer_id,
        round2(input.sale_price),
        round2(input.associated_costs),
        input.sold_at ?? null,
        input.notes ?? null,
        now,
      );
      const soldId = Number(soldResult.lastInsertRowid);

      for (const item of input.items) {
        insertItemStmt.run(soldId, item.buy_id, item.quantity);
      }

      return rowToSold(getStmt.get(soldId) as SoldRow);
    })();
  }

  function getById(id: number): Sold | null {
    const row = getStmt.get(id) as SoldRow | undefined;
    return row ? rowToSold(row) : null;
  }

  function getByIdWithItems(id: number): SoldWithItems | null {
    const soldRow = getStmt.get(id) as SoldRow | undefined;
    if (!soldRow) return null;

    const metaRow = db
      .prepare('SELECT name AS customer_name FROM customers WHERE id = ?')
      .get(soldRow.customer_id) as { customer_name: string } | undefined;

    const itemRows = db
      .prepare(
        `SELECT si.buy_id, b.product_name, si.quantity,
          ROUND(b.purchase_cost / b.quantity, 2) AS unit_cost,
          ROUND(b.associated_costs / b.quantity, 2) AS unit_assoc
         FROM sale_items si
         JOIN buys b ON b.id = si.buy_id
         WHERE si.sold_id = ?`,
      )
      .all(id) as SaleItemRow[];

    const items: SaleItemOutput[] = itemRows.map((r) => ({
      buy_id: r.buy_id,
      product_name: r.product_name,
      quantity: r.quantity,
      unit_cost: r.unit_cost,
      unit_assoc: r.unit_assoc,
    }));

    return {
      ...rowToSold(soldRow),
      customer_name: metaRow?.customer_name ?? '',
      items,
    };
  }

  function list(filters?: SoldListFilters): Sold[] {
    const customerId = filters?.customerId ?? null;
    const from = filters?.dateRange?.from || null;
    const to = filters?.dateRange?.to || null;
    const rows = db
      .prepare(
        `SELECT * FROM solds
         WHERE (? IS NULL OR customer_id = ?)
           AND (? IS NULL OR sold_at >= ?)
           AND (? IS NULL OR sold_at <= ?)
         ORDER BY id DESC`,
      )
      .all(customerId, customerId, from, from, to, to) as SoldRow[];
    return rows.map(rowToSold);
  }

  function listWithProfit(filters?: SoldListFilters): SoldWithProfit[] {
    const customerId = filters?.customerId ?? null;
    const from = filters?.dateRange?.from || null;
    const to = filters?.dateRange?.to || null;
    const rows = db
      .prepare(
        `SELECT s.*,
          s.sale_price - s.associated_costs - COALESCE((
            SELECT SUM(si.quantity * (ROUND(b.purchase_cost / b.quantity, 2) + ROUND(b.associated_costs / b.quantity, 2)))
            FROM sale_items si
            JOIN buys b ON b.id = si.buy_id
            WHERE si.sold_id = s.id
          ), 0) AS profit
         FROM solds s
         WHERE (? IS NULL OR s.customer_id = ?)
           AND (? IS NULL OR s.sold_at >= ?)
           AND (? IS NULL OR s.sold_at <= ?)
         ORDER BY s.id DESC`,
      )
      .all(customerId, customerId, from, from, to, to) as Array<SoldRow & { profit: number }>;

    if (rows.length === 0) return [];

    const soldIds = rows.map((r) => r.id);
    const itemRows = db
      .prepare(
        `SELECT si.sold_id, si.buy_id, b.product_name, si.quantity,
          ROUND(b.purchase_cost / b.quantity, 2) AS unit_cost,
          ROUND(b.associated_costs / b.quantity, 2) AS unit_assoc
         FROM sale_items si
         JOIN buys b ON b.id = si.buy_id
         WHERE si.sold_id IN (SELECT value FROM json_each(?))
         ORDER BY si.sold_id, si.buy_id`,
      )
      .all(JSON.stringify(soldIds)) as Array<{
      sold_id: number;
      buy_id: number;
      product_name: string;
      quantity: number;
      unit_cost: number;
      unit_assoc: number;
    }>;

    const itemsBySold = new Map<number, SaleItemOutput[]>();
    for (const row of itemRows) {
      const list = itemsBySold.get(row.sold_id) ?? [];
      list.push({
        buy_id: row.buy_id,
        product_name: row.product_name,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        unit_assoc: row.unit_assoc,
      });
      itemsBySold.set(row.sold_id, list);
    }

    return rows.map((r) => ({
      ...rowToSold(r),
      profit: round2(r.profit),
      items: itemsBySold.get(r.id) ?? [],
    }));
  }

  function update(id: number, input: UpdateSoldInput): Sold | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = definedOnly(input);
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = {
      ...existing,
      ...definedPatch,
      sale_price: round2(definedPatch.sale_price ?? existing.sale_price),
      associated_costs: round2(definedPatch.associated_costs ?? existing.associated_costs),
      id: existing.id,
      created_at: existing.created_at,
    };

    updateStmt.run(
      next.customer_id,
      next.sale_price,
      next.associated_costs,
      next.sold_at ?? null,
      next.notes ?? null,
      id,
    );

    return getById(id);
  }

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  function statsDashboard(): DashboardStats {
    return db.transaction((): DashboardStats => computeStats())();
  }

  function computeStats(): DashboardStats {
    const buysRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(purchase_cost), 0) AS compras_total,
           COALESCE(SUM(associated_costs), 0) AS gastos_asociados_total
         FROM buys`,
      )
      .get() as { compras_total: number; gastos_asociados_total: number };

    const sellsRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(sale_price), 0) AS ventas_total,
           COALESCE(SUM(associated_costs), 0) AS gastos_asociados_total
         FROM solds`,
      )
      .get() as { ventas_total: number; gastos_asociados_total: number };

    const stockRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM buys b
         WHERE (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) > 0`,
      )
      .get() as { cnt: number };

    const profitRow = db
      .prepare(
        `SELECT COALESCE(SUM(profit), 0) AS total
         FROM (
           SELECT
             s.sale_price - s.associated_costs -
             COALESCE((
               SELECT SUM(si.quantity * ROUND(b.purchase_cost / b.quantity, 2))
                      + SUM(si.quantity * ROUND(b.associated_costs / b.quantity, 2))
               FROM sale_items si
               JOIN buys b ON b.id = si.buy_id
               WHERE si.sold_id = s.id
             ), 0) AS profit
           FROM solds s
         ) sub`,
      )
      .get() as { total: number };

    const kpis = {
      compras_total_eur: round2(
        buysRow.compras_total + buysRow.gastos_asociados_total + sellsRow.gastos_asociados_total,
      ),
      ventas_total_eur: round2(sellsRow.ventas_total),
      beneficio_total_eur: round2(profitRow.total),
      stock_pendiente_count: stockRow.cnt,
    };

    const purchasesRows = db
      .prepare(
        `SELECT month,
                COALESCE(SUM(compras_de_buys), 0) AS compras_de_buys,
                COALESCE(SUM(asociados_de_solds), 0) AS asociados_de_solds
         FROM (
           SELECT strftime('%Y-%m', purchase_date) AS month,
                  purchase_cost + associated_costs AS compras_de_buys,
                  0 AS asociados_de_solds
           FROM buys
           WHERE purchase_date IS NOT NULL
           UNION ALL
           SELECT strftime('%Y-%m', sold_at) AS month,
                  0 AS compras_de_buys,
                  associated_costs AS asociados_de_solds
           FROM solds
           WHERE sold_at IS NOT NULL
         )
         GROUP BY month`,
      )
      .all() as Array<{ month: string; compras_de_buys: number; asociados_de_solds: number }>;

    const salesRows = db
      .prepare(
        `SELECT
           strftime('%Y-%m', s.sold_at) AS month,
           COALESCE(SUM(s.sale_price), 0) AS ingresos,
           COALESCE(SUM(s.sale_price - s.associated_costs - cogs_calc.cogs), 0) AS beneficio
         FROM solds s
         JOIN (
           SELECT si.sold_id,
                  SUM(si.quantity * ROUND(b.purchase_cost / b.quantity, 2))
                  + SUM(si.quantity * ROUND(b.associated_costs / b.quantity, 2)) AS cogs
           FROM sale_items si
           JOIN buys b ON b.id = si.buy_id
           GROUP BY si.sold_id
         ) cogs_calc ON cogs_calc.sold_id = s.id
         WHERE s.sold_at IS NOT NULL
         GROUP BY month`,
      )
      .all() as Array<{ month: string; ingresos: number; beneficio: number }>;

    const purchasesMap = new Map(purchasesRows.map((r) => [r.month, r]));
    const salesMap = new Map(salesRows.map((r) => [r.month, r]));
    const months = lastNMonths(12);
    const cashFlowByMonth = months.map((month) => {
      const purchase = purchasesMap.get(month);
      const sale = salesMap.get(month);
      const compras = round2(
        (purchase?.compras_de_buys ?? 0) + (purchase?.asociados_de_solds ?? 0),
      );
      const ingresos = round2(sale?.ingresos ?? 0);
      const beneficio = round2(sale?.beneficio ?? 0);
      const resultado = round2(beneficio - (purchase?.compras_de_buys ?? 0));
      return {
        month,
        ingresos,
        compras,
        beneficio,
        resultado,
      };
    });

    const topProducts = db
      .prepare(
        `SELECT
           b.id AS product_id,
           b.product_name,
           SUM(si.quantity) AS times_sold,
           SUM(si.quantity * (s.sale_price * 1.0 / st.total_qty)) AS total_revenue,
           SUM(si.quantity * (s.associated_costs * 1.0 / st.total_qty)) AS total_assoc_sale,
           SUM(si.quantity * ROUND(b.purchase_cost / b.quantity, 2)) AS total_unit_cost,
           SUM(si.quantity * ROUND(b.associated_costs / b.quantity, 2)) AS total_unit_assoc
         FROM sale_items si
         JOIN solds s ON s.id = si.sold_id
         JOIN buys b ON b.id = si.buy_id
         JOIN (
           SELECT sold_id, SUM(quantity) AS total_qty
           FROM sale_items
           GROUP BY sold_id
         ) st ON st.sold_id = s.id
         GROUP BY b.id
         ORDER BY total_revenue DESC
         LIMIT 10`,
      )
      .all() as Array<{
      product_id: number;
      product_name: string;
      times_sold: number;
      total_revenue: number;
      total_assoc_sale: number;
      total_unit_cost: number;
      total_unit_assoc: number;
    }>;

    const topProductsFormatted = topProducts.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      times_sold: r.times_sold,
      total_revenue: round2(r.total_revenue),
      total_profit: round2(
        r.total_revenue - r.total_assoc_sale - r.total_unit_cost - r.total_unit_assoc,
      ),
    }));

    const topBuyers = db
      .prepare(
        `SELECT c.id AS customer_id, c.name AS customer_name,
           COUNT(s.id) AS ventas,
           SUM(s.sale_price) AS total_gastado
         FROM customers c
         JOIN solds s ON s.customer_id = c.id
         GROUP BY c.id
         ORDER BY total_gastado DESC
         LIMIT 10`,
      )
      .all() as Array<{
      customer_id: number;
      customer_name: string;
      ventas: number;
      total_gastado: number;
    }>;

    const topBuyersFormatted = topBuyers.map((r) => ({
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      ventas: r.ventas,
      total_gastado: round2(r.total_gastado),
    }));

    return {
      kpis,
      cashFlowByMonth,
      topProducts: topProductsFormatted,
      topBuyers: topBuyersFormatted,
    };
  }

  return {
    createManyWithStockCheck,
    getById,
    getByIdWithItems,
    list,
    listWithProfit,
    update,
    remove,
    statsDashboard,
  };
}
