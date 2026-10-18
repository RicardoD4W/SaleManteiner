import type { Database } from 'better-sqlite3';
import { round2 } from '../lib/round.js';
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

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ListFilters {
  customerId?: number;
  dateRange?: DateRange;
}

/** Error de stock insuficiente (S7). */
export interface StockInsufficientError {
  error: 'Stock insuficiente';
  items: Array<{
    buy_id: number;
    product_name: string;
    disponibles: number;
    solicitado: number;
  }>;
}

export interface SoldsRepo {
  create(input: CreateSoldInput): Sold;
  /** Creación transaccional con validación de stock (S7). Lanza StockInsufficientError si no cubre. */
  createManyWithStockCheck(input: CreateSoldInput): Sold;
  getById(id: number): Sold | null;
  /** Venta con sus items y nombre del cliente (S8 detail query). */
  getByIdWithItems(id: number): SoldWithItems | null;
  list(filters?: ListFilters): Sold[];
  update(id: number, input: UpdateSoldInput): Sold | null;
  remove(id: number): boolean;
  statsDashboard(): DashboardStats;
}

export interface DashboardStats {
  kpis: {
    compras_total_eur: number;
    ventas_total_eur: number;
    beneficio_total_eur: number;
    stock_pendiente_count: number;
  };
  revenueByMonth: Array<{ month: string; revenue: number; profit: number }>;
  topProducts: Array<{
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

  /**
   * Crea una venta con validación de stock transaccional (S7).
   * Dentro de db.transaction:
   *   1. Lee stock disponible de cada buy_id.
   *   2. Si alguno no cubre → rollback + lanza StockInsufficientError.
   *   3. Si todos cubren → INSERT solds + INSERT sale_items.
   */
  function createManyWithStockCheck(input: CreateSoldInput): Sold {
    return db.transaction(() => {
      const now = new Date().toISOString();

      // 1. Validar stock de cada item
      const stockErrors: StockInsufficientError['items'] = [];

      for (const item of input.items) {
        const rows = db
          .prepare(
            `SELECT b.id AS buy_id, b.product_name,
              (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
             FROM buys b WHERE b.id = ?`,
          )
          .get(item.buy_id) as
          | { buy_id: number; product_name: string; disponibles: number }
          | undefined;

        if (!rows) {
          // El buy_id no existe → tratar como stock 0
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
        // Lanzamos el error plano con propiedad `error` + `items` para que la
        // ruta pueda leer `err.error === 'Stock insuficiente'` y extraer `err.items`.
        const err: StockInsufficientError = {
          error: 'Stock insuficiente',
          items: stockErrors,
        };
        throw err;
      }

      // 2. INSERT solds
      const soldResult = insertSoldStmt.run(
        input.customer_id,
        round2(input.sale_price),
        round2(input.associated_costs),
        input.sold_at ?? null,
        input.notes ?? null,
        now,
      );
      const soldId = Number(soldResult.lastInsertRowid);

      // 3. INSERT sale_items
      for (const item of input.items) {
        insertItemStmt.run(soldId, item.buy_id, item.quantity);
      }

      return rowToSold(getStmt.get(soldId) as SoldRow);
    })();
  }

  function create(input: CreateSoldInput): Sold {
    return createManyWithStockCheck(input);
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

  function list(filters?: ListFilters): Sold[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.customerId !== undefined) {
      conditions.push('customer_id = ?');
      params.push(filters.customerId);
    }
    if (filters?.dateRange?.from) {
      conditions.push('sold_at >= ?');
      params.push(filters.dateRange.from);
    }
    if (filters?.dateRange?.to) {
      conditions.push('sold_at <= ?');
      params.push(filters.dateRange.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM solds ${where} ORDER BY id DESC LIMIT 200`)
      .all(...params) as SoldRow[];
    return rows.map(rowToSold);
  }

  function update(id: number, input: UpdateSoldInput): Sold | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = {
      ...existing,
      ...definedPatch,
      sale_price: round2(
        ((definedPatch.sale_price as number | undefined) ?? existing.sale_price),
      ),
      associated_costs: round2(
        ((definedPatch.associated_costs as number | undefined) ?? existing.associated_costs),
      ),
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
    // ── KPIs ────────────────────────────────────────────────────────────────
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

    // beneficio_total_eur = SUMA de beneficio por venta (S13). El beneficio
    // de cada venta es: sale_price - associated_costs - COGS_prorrateado.
    // NO restamos la inversión total de buys (incluye stock pendiente que
    // todavía no se vendió); eso va en `compras_total_eur` por separado.
    const beneficioRow = db
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
      compras_total_eur: round2(buysRow.compras_total + buysRow.gastos_asociados_total),
      ventas_total_eur: round2(sellsRow.ventas_total),
      beneficio_total_eur: round2(beneficioRow.total),
      stock_pendiente_count: stockRow.cnt,
    };

    // ── Revenue by month (últimos 12 meses, incluyendo meses sin ventas) ────
    const monthRows = db
      .prepare(
        `SELECT
           strftime('%Y-%m', sold_at) AS month,
           SUM(s.sale_price) AS revenue,
           SUM(s.sale_price - s.associated_costs) AS raw_profit
         FROM solds s
         WHERE s.sold_at IS NOT NULL
           AND s.sold_at >= date('now', '-12 months')
         GROUP BY month`,
      )
      .all() as Array<{ month: string; revenue: number; raw_profit: number }>;

    // El profit mensual se calcula sin restar el coste de compra (eso se deduce
    // del total de inversión). El profit neto mensual = revenue - associated.
    const monthMap = new Map(monthRows.map((r) => [r.month, r]));
    const months = lastNMonths(12);
    const revenueByMonth = months.map((month) => {
      const r = monthMap.get(month);
      return {
        month,
        revenue: r ? round2(r.revenue) : 0,
        profit: r ? round2(r.raw_profit) : 0,
      };
    });

    // ── Top products (prorrateo por unidad para packs) ────────────────────
    // Para una venta con N items (sum_quantity = total_qty), el revenue y
    // los associated_costs se prorratean por unidad entre los items. Sin
    // este prorrateo, una venta de pack de 2 items con sale_price=100€
    // contaría 100€ de revenue para CADA producto (over-count).
    const topProducts = db
      .prepare(
        `SELECT
           b.product_name,
           COUNT(*) AS times_sold,
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
      product_name: string;
      times_sold: number;
      total_revenue: number;
      total_assoc_sale: number;
      total_unit_cost: number;
      total_unit_assoc: number;
    }>;

    const topProductsFormatted = topProducts.map((r) => ({
      product_name: r.product_name,
      times_sold: r.times_sold,
      total_revenue: round2(r.total_revenue),
      total_profit: round2(
        r.total_revenue - r.total_assoc_sale - r.total_unit_cost - r.total_unit_assoc,
      ),
    }));

    // ── Top buyers (S8) ────────────────────────────────────────────────────
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

    return { kpis, revenueByMonth, topProducts: topProductsFormatted, topBuyers: topBuyersFormatted };
  }

  return {
    create,
    createManyWithStockCheck,
    getById,
    getByIdWithItems,
    list,
    update,
    remove,
    statsDashboard,
  };
}
