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

/** Venta asociada a un buy (para el 409 del DELETE de buys). */
export interface AssociatedSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  /**
   * Total de unidades vendidas de este buy dentro de la venta
   * (suma de sale_items.quantity filtrada por buy_id). En un pack multi-item
   * NO se cuentan los items de los otros buys.
   */
  items_count: number;
}

/**
 * Resultado discriminado de `BuysRepo.remove`.
 *  - `{ ok: true }`: la compra no tenía ventas asociadas y se borró.
 *  - `{ ok: false, code: 'NOT_FOUND' }`: el id no existe.
 *  - `{ ok: false, code: 'HAS_ASSOCIATED_SALES', sales }`: la compra tiene
 *    ventas vinculadas. La ruta mapea este caso a 409 con el body
 *    `{ error, associated_sales: sales }`.
 */
export type RemoveBuyResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_ASSOCIATED_SALES'; sales: AssociatedSale[] };

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
  /**
   * Borra una compra. Si tiene ventas asociadas (sale_items.buy_id
   * ON DELETE RESTRICT) NO la borra y devuelve
   * `{ ok: false, code: 'HAS_ASSOCIATED_SALES', sales }` para que la UI
   * pueda pedir confirmación. Si el id no existe → `NOT_FOUND`.
   */
  remove(id: number): RemoveBuyResult;
  /**
   * Borra una compra EN CASCADA. Para cada venta que la contiene,
   * quita el item de este buy; si la venta queda con 0 items, la borra.
   * Devuelve `true` si la compra existía y se borró, `false` si no
   * existía. La ruta mapea este método a `DELETE /api/buys/:id/cascade`.
   */
  removeWithCascade(id: number): boolean;
  /**
   * Lista las ventas que referencian este buy (con `customer_name`,
   * `sold_at` y `items_count`). La ruta la usa para el body del 409 y
   * para el audit trail del borrado en cascada (S13): como la cascada no
   * tiene undo, el server deja registro de qué ventas se eliminaron.
   */
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

  function list(filters?: ListFilters): Buy[] {
    // El WHERE es FIJO: el filtro viaja como parámetro bindeado y la
    // condición se activa con `? IS NULL`. Así no hay ningún fragmento de
    // SQL armado por concatenación (el valor nunca se interpola).
    // `|| null` (y no `?? null`) a propósito: el filtro anterior usaba un
    // check de truthiness, así que la cadena vacía significaba "sin
    // filtro". Con `||` la equivalencia es exacta.
    const from = filters?.dateRange?.from || null;
    const to = filters?.dateRange?.to || null;
    const rows = db
      .prepare(
        `SELECT * FROM buys
         WHERE (? IS NULL OR purchase_date >= ?)
           AND (? IS NULL OR purchase_date <= ?)
         ORDER BY id DESC`,
      )
      .all(from, from, to, to) as BuyRow[];
    return rows.map(rowToBuy);
  }

  /**
   * Stock disponible (S8 del feature):
   * unidades compradas - SUM(sale_items.quantity WHERE buy_id = b.id)
   * HAVING disponibles > 0 ORDER BY id DESC
   */
  function listWithStock(filters?: ListFilters): BuyWithStock[] {
    // Mismo criterio que `list`: WHERE fijo + parámetros bindeados
    // (mismo `|| null` para preservar la semántica de la cadena vacía).
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

  /**
   * Lista las ventas que referencian este buy (sale_items.buy_id = ?),
   * con `customer_name` (JOIN a customers) y `items_count`
   * (SUM(quantity) por sold_id, filtrada por este buy — en packs NO
   * suma los items de otros buys). Orden DESC por sold_id.
   */
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
        // El FK sale_items.buy_id ON DELETE RESTRICT bloquearía el DELETE
        // con un error de SQLite. Devolvemos el resultado discriminado
        // para que la ruta emita un 409 con la lista de ventas (en vez
        // de propagar el error como 500).
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
      // Para cada venta que incluye este buy: borrar el item.
      // Si la venta queda con 0 items, borrarla (los sale_items restantes
      // se eliminan solos por ON DELETE CASCADE del FK sold_id).
      const soldIds = db
        .prepare(`SELECT DISTINCT sold_id FROM sale_items WHERE buy_id = ?`)
        .all(id) as Array<{ sold_id: number }>;
      const deleteItemStmt = db.prepare(
        `DELETE FROM sale_items WHERE sold_id = ? AND buy_id = ?`,
      );
      const countItemsStmt = db.prepare(
        `SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?`,
      );
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
    list,
    listWithStock,
    getWithStock,
    update,
    remove,
    removeWithCascade,
    listAssociatedSales,
  };
}
