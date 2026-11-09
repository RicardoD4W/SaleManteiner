import type { Database } from 'better-sqlite3';
import { round2 } from '../lib/round.js';
import { definedOnly } from '../lib/defined-only.js';
import type { AssociatedSale, CascadeResult, DateRange } from './types.js';
import { UnknownTagError } from './tags-repo.js';
import type { Buy } from '../schemas/buys.js';
import type { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

interface BuyRow {
  id: number;
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs: number;
  purchase_date: string | null;
  notes: string | null;
  tag_id: number | null;
  tag_name: string | null;
  tag_color: string | null;
  created_at: string;
}

function rowToBuy(row: BuyRow): Buy {
  return {
    id: row.id,
    product_name: row.product_name,
    purchase_cost: row.purchase_cost,
    quantity: row.quantity,
    total_cost: round2(row.purchase_cost * row.quantity),
    associated_costs: row.associated_costs,
    purchase_date: row.purchase_date,
    notes: row.notes,
    tag:
      row.tag_id !== null && row.tag_name !== null && row.tag_color !== null
        ? { id: row.tag_id, name: row.tag_name, color: row.tag_color }
        : null,
    created_at: row.created_at,
  };
}

export interface BuyListFilters {
  dateRange?: DateRange;
  tagIds?: number[];
  sinTag?: boolean;
}

export interface BuyWithStock extends Buy {
  disponibles: number;
}

export interface ProductName {
  name: string;
  uses: number;
}

export type RemoveBuyResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_ASSOCIATED_SALES'; sales: AssociatedSale[] };

export interface BuysRepo {
  create(input: CreateBuyInput): Buy;
  getById(id: number): Buy | null;
  listWithStock(filters?: BuyListFilters): BuyWithStock[];
  getWithStock(): BuyWithStock[];
  listProductNames(): ProductName[];
  update(id: number, input: UpdateBuyInput): Buy | null;
  remove(id: number): RemoveBuyResult;
  removeWithCascade(id: number): CascadeResult;
  listAssociatedSales(id: number): AssociatedSale[];
}

export function createBuysRepo(db: Database): BuysRepo {
  const insertStmt = db.prepare(`
    INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, notes, tag_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const getStmt = db.prepare(`
    SELECT b.*, t.name AS tag_name, t.color AS tag_color
    FROM buys b
    LEFT JOIN tags t ON t.id = b.tag_id
    WHERE b.id = ?
  `);
  const deleteStmt = db.prepare('DELETE FROM buys WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE buys SET
      product_name = ?,
      purchase_cost = ?,
      quantity = ?,
      associated_costs = ?,
      purchase_date = ?,
      notes = ?,
      tag_id = ?
    WHERE id = ?
  `);
  const listWithStockSelect = `
    SELECT b.*,
      (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles,
      t.name AS tag_name,
      t.color AS tag_color
    FROM buys b
    LEFT JOIN tags t ON t.id = b.tag_id
  `;
  const listWithStockStmt = db.prepare(`
    ${listWithStockSelect}
    WHERE (? IS NULL OR b.purchase_date >= ?)
      AND (? IS NULL OR b.purchase_date <= ?)
    ORDER BY b.id DESC
  `);
  const getWithStockStmt = db.prepare(`
    SELECT b.*,
      (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
    FROM buys b
    WHERE (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) > 0
    ORDER BY b.id DESC
  `);
  const listProductNamesStmt = db.prepare(`
    SELECT b.product_name AS name, COUNT(*) AS uses, MAX(b.id) AS last_id
    FROM buys b
    GROUP BY b.product_name COLLATE NOCASE
    ORDER BY uses DESC, last_id DESC
  `);
  const listAssociatedSalesStmt = db.prepare(`
    SELECT s.id, c.name AS customer_name, s.sold_at, si_agg.items_count
    FROM (
      SELECT sold_id, SUM(quantity) AS items_count
      FROM sale_items
      WHERE buy_id = ?
      GROUP BY sold_id
    ) si_agg
    JOIN solds s ON s.id = si_agg.sold_id
    JOIN customers c ON c.id = s.customer_id
    ORDER BY s.id DESC
  `);
  const cascadeSoldIdsStmt = db.prepare(`SELECT DISTINCT sold_id FROM sale_items WHERE buy_id = ?`);
  const deleteItemStmt = db.prepare(`DELETE FROM sale_items WHERE sold_id = ? AND buy_id = ?`);
  const deleteSoldIfEmptyStmt = db.prepare(
    `DELETE FROM solds WHERE id = ? AND NOT EXISTS (SELECT 1 FROM sale_items WHERE sold_id = ?)`,
  );

  function assertTagExists(tagId: number | null | undefined): void {
    if (tagId === null || tagId === undefined) return;
    const row = db.prepare('SELECT id FROM tags WHERE id = ? AND scope = ?').get(tagId, 'buy');
    if (!row) throw new UnknownTagError();
  }

  function create(input: CreateBuyInput): Buy {
    assertTagExists(input.tag_id);
    const now = new Date().toISOString();
    const result = insertStmt.run(
      input.product_name,
      round2(input.purchase_cost),
      input.quantity,
      round2(input.associated_costs),
      input.purchase_date ?? null,
      input.notes ?? null,
      input.tag_id ?? null,
      now,
    );
    const id = Number(result.lastInsertRowid);
    return rowToBuy(getStmt.get(id) as BuyRow);
  }

  function getById(id: number): Buy | null {
    const row = getStmt.get(id) as BuyRow | undefined;
    return row ? rowToBuy(row) : null;
  }

  function listWithStock(filters?: BuyListFilters): BuyWithStock[] {
    const from = filters?.dateRange?.from || null;
    const to = filters?.dateRange?.to || null;
    const tagIds = filters?.tagIds ?? [];
    const sinTag = filters?.sinTag === true;

    if (!sinTag && tagIds.length === 0) {
      const rows = listWithStockStmt.all(from, from, to, to) as (BuyRow & {
        disponibles: number;
      })[];
      return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
    }

    const tagClause = sinTag
      ? 'b.tag_id IS NULL'
      : `b.tag_id IN (${tagIds.map(() => '?').join(', ')})`;
    const params: unknown[] = [from, from, to, to, ...(sinTag ? [] : tagIds)];
    const stmt = db.prepare(`
      ${listWithStockSelect}
      WHERE (? IS NULL OR b.purchase_date >= ?)
        AND (? IS NULL OR b.purchase_date <= ?)
        AND ${tagClause}
      ORDER BY b.id DESC
    `);
    const rows = stmt.all(...params) as (BuyRow & { disponibles: number })[];
    return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
  }

  function getWithStock(): BuyWithStock[] {
    const rows = getWithStockStmt.all() as (BuyRow & { disponibles: number })[];
    return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
  }

  function update(id: number, input: UpdateBuyInput): Buy | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = definedOnly(input);
    if (Object.keys(definedPatch).length === 0) return existing;
    assertTagExists(definedPatch.tag_id);

    const next = {
      ...existing,
      ...definedPatch,
      purchase_cost: round2(definedPatch.purchase_cost ?? existing.purchase_cost),
      associated_costs: round2(definedPatch.associated_costs ?? existing.associated_costs),
      id: existing.id,
      created_at: existing.created_at,
    };
    const nextTagId =
      definedPatch.tag_id !== undefined ? definedPatch.tag_id : (existing.tag?.id ?? null);

    updateStmt.run(
      next.product_name,
      next.purchase_cost,
      next.quantity,
      next.associated_costs,
      next.purchase_date ?? null,
      next.notes ?? null,
      nextTagId,
      id,
    );

    return getById(id);
  }

  function listProductNames(): ProductName[] {
    const rows = listProductNamesStmt.all() as Array<{ name: string; uses: number }>;
    return rows.map((row) => ({ name: row.name, uses: row.uses }));
  }

  function listAssociatedSales(id: number): AssociatedSale[] {
    return listAssociatedSalesStmt.all(id) as Array<{
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

  function removeWithCascade(id: number): CascadeResult {
    return db.transaction((): CascadeResult => {
      const soldIds = cascadeSoldIdsStmt.all(id) as Array<{ sold_id: number }>;
      for (const { sold_id } of soldIds) {
        deleteItemStmt.run(sold_id, id);
        deleteSoldIfEmptyStmt.run(sold_id, sold_id);
      }
      if (deleteStmt.run(id).changes === 0) return { ok: false, code: 'NOT_FOUND' };
      return { ok: true };
    })();
  }

  return {
    create,
    getById,
    listWithStock,
    getWithStock,
    listProductNames,
    update,
    remove,
    removeWithCascade,
    listAssociatedSales,
  };
}
