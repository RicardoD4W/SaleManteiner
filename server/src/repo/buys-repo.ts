import type { Database } from 'better-sqlite3';
import { round2 } from '../lib/round.js';
import type { Buy } from '../schemas/buys.js';
import type { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

interface BuyRow {
  id: number;
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs: number;
  purchase_date: string | null;
  created_at: string;
}

function rowToBuy(row: BuyRow): Buy {
  return {
    id: row.id,
    product_name: row.product_name,
    purchase_cost: row.purchase_cost,
    quantity: row.quantity,
    associated_costs: row.associated_costs,
    purchase_date: row.purchase_date,
    created_at: row.created_at,
  };
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ListFilters {
  dateRange?: DateRange;
}

export interface BuyWithStock extends Buy {
  disponibles: number;
}

export interface AssociatedSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

export type RemoveBuyResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_ASSOCIATED_SALES'; sales: AssociatedSale[] };

export interface BuysRepo {
  create(input: CreateBuyInput): Buy;
  getById(id: number): Buy | null;
  listWithStock(filters?: ListFilters): BuyWithStock[];
  getWithStock(): BuyWithStock[];
  update(id: number, input: UpdateBuyInput): Buy | null;
  remove(id: number): RemoveBuyResult;
  removeWithCascade(id: number): boolean;
  listAssociatedSales(id: number): AssociatedSale[];
}

export function createBuysRepo(db: Database): BuysRepo {
  const insertStmt = db.prepare(`
    INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getStmt = db.prepare('SELECT * FROM buys WHERE id = ?');
  const deleteStmt = db.prepare('DELETE FROM buys WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE buys SET
      product_name = ?,
      purchase_cost = ?,
      quantity = ?,
      associated_costs = ?,
      purchase_date = ?
    WHERE id = ?
  `);

  function create(input: CreateBuyInput): Buy {
    const now = new Date().toISOString();
    const result = insertStmt.run(
      input.product_name,
      round2(input.purchase_cost),
      input.quantity,
      round2(input.associated_costs),
      input.purchase_date ?? null,
      now,
    );
    const id = Number(result.lastInsertRowid);
    return rowToBuy(getStmt.get(id) as BuyRow);
  }

  function getById(id: number): Buy | null {
    const row = getStmt.get(id) as BuyRow | undefined;
    return row ? rowToBuy(row) : null;
  }

  function listWithStock(filters?: ListFilters): BuyWithStock[] {
    const from = filters?.dateRange?.from || null;
    const to = filters?.dateRange?.to || null;
    const rows = db
      .prepare(
        `SELECT b.*,
          (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
         FROM buys b
         WHERE (? IS NULL OR b.purchase_date >= ?)
           AND (? IS NULL OR b.purchase_date <= ?)
         ORDER BY b.id DESC`,
      )
      .all(from, from, to, to) as (BuyRow & { disponibles: number })[];
    return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
  }

  function getWithStock(): BuyWithStock[] {
    const rows = db
      .prepare(
        `SELECT b.*,
          (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
         FROM buys b
         WHERE (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) > 0
         ORDER BY b.id DESC`,
      )
      .all() as (BuyRow & { disponibles: number })[];
    return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
  }

  function update(id: number, input: UpdateBuyInput): Buy | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = {
      ...existing,
      ...definedPatch,
      purchase_cost: round2(
        (definedPatch.purchase_cost as number | undefined) ?? existing.purchase_cost,
      ),
      associated_costs: round2(
        (definedPatch.associated_costs as number | undefined) ?? existing.associated_costs,
      ),
      id: existing.id,
      created_at: existing.created_at,
    };

    updateStmt.run(
      next.product_name,
      next.purchase_cost,
      next.quantity,
      next.associated_costs,
      next.purchase_date ?? null,
      id,
    );

    return getById(id);
  }

  function listAssociatedSales(id: number): AssociatedSale[] {
    return db
      .prepare(
        `SELECT s.id, c.name AS customer_name, s.sold_at, si_agg.items_count
         FROM (
           SELECT sold_id, SUM(quantity) AS items_count
           FROM sale_items
           WHERE buy_id = ?
           GROUP BY sold_id
         ) si_agg
         JOIN solds s ON s.id = si_agg.sold_id
         JOIN customers c ON c.id = s.customer_id
         ORDER BY s.id DESC`,
      )
      .all(id) as Array<{
      id: number;
      customer_name: string;
      sold_at: string | null;
      items_count: number;
    }>;
  }

  function remove(id: number): RemoveBuyResult {
    return db.transaction((): RemoveBuyResult => {
      const existing = getStmt.get(id) as BuyRow | undefined;
      if (!existing) return { ok: false, code: 'NOT_FOUND' };
      const sales = listAssociatedSales(id);
      if (sales.length > 0) {
        return { ok: false, code: 'HAS_ASSOCIATED_SALES', sales };
      }
      deleteStmt.run(id);
      return { ok: true };
    })();
  }

  function removeWithCascade(id: number): boolean {
    return db.transaction((): boolean => {
      const existing = getStmt.get(id) as BuyRow | undefined;
      if (!existing) return false;
      const soldIds = db
        .prepare(`SELECT DISTINCT sold_id FROM sale_items WHERE buy_id = ?`)
        .all(id) as Array<{ sold_id: number }>;
      const deleteItemStmt = db.prepare(`DELETE FROM sale_items WHERE sold_id = ? AND buy_id = ?`);
      const countItemsStmt = db.prepare(`SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?`);
      const deleteSoldStmt = db.prepare(`DELETE FROM solds WHERE id = ?`);
      for (const { sold_id } of soldIds) {
        deleteItemStmt.run(sold_id, id);
        const { c } = countItemsStmt.get(sold_id) as { c: number };
        if (c === 0) deleteSoldStmt.run(sold_id);
      }
      return deleteStmt.run(id).changes > 0;
    })();
  }

  return {
    create,
    getById,
    listWithStock,
    getWithStock,
    update,
    remove,
    removeWithCascade,
    listAssociatedSales,
  };
}
