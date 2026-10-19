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
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface ListFilters {
  dateRange?: DateRange;
}

export interface BuyWithStock extends Buy {
  /** Unidades disponibles para vender = quantity - SUM(sale_items.quantity). */
  disponibles: number;
}

export interface BuysRepo {
  create(input: CreateBuyInput): Buy;
  getById(id: number): Buy | null;
  list(filters?: ListFilters): Buy[];
  /**
   * Devuelve TODAS las compras con su stock disponible calculado
   * (`quantity - SUM(sale_items.quantity)`), incluso las que ya no tienen
   * stock (disponibles = 0). Respeta los mismos filtros que `list()`.
   * Alimenta `GET /api/buys` para que la tabla de /buys pueda mostrar los
   * pendientes en gris como pista visual (S3 del feature
   * dashboard-iteration-1 — decisión: "Todas + disponibles").
   */
  listWithStock(filters?: ListFilters): BuyWithStock[];
  /** Devuelve compras con stock disponible (disponibles > 0), orden DESC por id. */
  getWithStock(): BuyWithStock[];
  update(id: number, input: UpdateBuyInput): Buy | null;
  remove(id: number): boolean;
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

  function list(filters?: ListFilters): Buy[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.dateRange?.from) {
      conditions.push('purchase_date >= ?');
      params.push(filters.dateRange.from);
    }
    if (filters?.dateRange?.to) {
      conditions.push('purchase_date <= ?');
      params.push(filters.dateRange.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM buys ${where} ORDER BY id DESC`)
      .all(...params) as BuyRow[];
    return rows.map(rowToBuy);
  }

  /**
   * Stock disponible (S8 del feature):
   * unidades compradas - SUM(sale_items.quantity WHERE buy_id = b.id)
   * HAVING disponibles > 0 ORDER BY id DESC
   */
  function listWithStock(filters?: ListFilters): BuyWithStock[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.dateRange?.from) {
      conditions.push('b.purchase_date >= ?');
      params.push(filters.dateRange.from);
    }
    if (filters?.dateRange?.to) {
      conditions.push('b.purchase_date <= ?');
      params.push(filters.dateRange.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT b.*,
          (b.quantity - COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.buy_id = b.id), 0)) AS disponibles
         FROM buys b
         ${where}
         ORDER BY b.id DESC`,
      )
      .all(...params) as (BuyRow & { disponibles: number })[];
    return rows.map((row) => ({ ...rowToBuy(row), disponibles: row.disponibles }));
  }

  function getWithStock(): BuyWithStock[] {
    // WHERE subquery > 0 (no HAVING porque no hay GROUP BY)
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
      // purchase_cost y associated_costs se redondean al actualizar
      // definedPatch values are already typed from UpdateBuyInput
      purchase_cost: round2(
        ((definedPatch.purchase_cost as number | undefined) ?? existing.purchase_cost),
      ),
      associated_costs: round2(
        ((definedPatch.associated_costs as number | undefined) ?? existing.associated_costs),
      ),
      // No se pisa id ni created_at
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

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  return { create, getById, list, listWithStock, getWithStock, update, remove };
}
