import type { Database } from 'better-sqlite3';
import type { Cents, RowId } from '../schemas/common.js';
import type { CreateSaleInput, Sale, UpdateSaleInput } from '../schemas/sales.js';

/**
 * Repo de ventas. Patrón factory: recibe un `Database` por inyección para que
 * los tests puedan usar `:memory:` sin tocar el singleton de producción.
 *
 * Reglas de negocio implementadas acá (no en SQL):
 *  - `created_at` se setea al insertar.
 *  - `purchase_date` y `sold_at` los gestiona el cliente: el server no las
 *    calcula automáticamente. (Históricamente `sold_at` se sincronizaba con
 *    `sold`; esa regla se eliminó al hacer la fecha editable. La coherencia
 *    `sold` ↔ `sold_at` la valida Zod al parsear el input — ver S3 en
 *    `schemas/sales.ts`. Si solo uno de los dos viene, se respeta tal cual.)
 *
 * Los defaults de campos opcionales (cost/price/associated = 0, sold = false)
 * viven en el schema (skill zod: `refine-defaults`), no acá.
 *
 * Nota sobre marcas (`Cents`, `RowId`):
 *  - Los valores que vienen de SQLite son `number` plano. Los casteamos al
 *    tipo branded al mapear la fila → `Sale`. Confiamos en el constraint
 *    CHECK de la tabla y en la validación del input.
 */
interface SaleRow {
  id: number;
  product_name: string;
  buyer_name: string | null;
  cost_cents: number;
  price_cents: number;
  associated_costs_cents: number;
  sold: number;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  sold_at: string | null;
}

function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id as RowId,
    product_name: row.product_name,
    buyer_name: row.buyer_name,
    cost_cents: row.cost_cents as Cents,
    price_cents: row.price_cents as Cents,
    associated_costs_cents: row.associated_costs_cents as Cents,
    sold: row.sold === 1,
    purchase_date: row.purchase_date,
    notes: row.notes,
    created_at: row.created_at,
    sold_at: row.sold_at,
  };
}

export interface ListFilters {
  sold?: boolean;
  limit?: number;
  offset?: number;
}

export interface SaleStats {
  total: number;
  sold: number;
  not_sold: number;
  revenue_cents: number;
  cost_cents: number;
  associated_costs_cents: number;
  net_profit_cents: number;
}

export interface SalesRepo {
  create(input: CreateSaleInput): Sale;
  /**
   * Inserción masiva atómica (Fase 3 / CSV import). Si alguna fila falla a
   * mitad de camino (constraint de BD, lo que sea), `db.transaction` revierte
   * TODO el batch — la garantía de "todo o nada" la da `better-sqlite3`.
   * Las N filas comparten el mismo `now` para `created_at` (asignamos un único
   * timestamp al inicio del batch) — evita drift de milisegundos dentro del
   * mismo import.
   */
  createMany(inputs: CreateSaleInput[]): Sale[];
  getById(id: number): Sale | null;
  list(filters?: ListFilters): Sale[];
  update(id: number, input: UpdateSaleInput): Sale | null;
  remove(id: number): boolean;
  stats(): SaleStats;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function createSalesRepo(db: Database): SalesRepo {
  const insertStmt = db.prepare(`
    INSERT INTO sales (
      product_name, buyer_name, cost_cents, price_cents,
      associated_costs_cents, sold, purchase_date, notes, created_at, sold_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getStmt = db.prepare('SELECT * FROM sales WHERE id = ?');
  const deleteStmt = db.prepare('DELETE FROM sales WHERE id = ?');

  function create(input: CreateSaleInput): Sale {
    return insertOne(input, new Date().toISOString());
  }

  function createMany(inputs: CreateSaleInput[]): Sale[] {
    if (inputs.length === 0) return [];
    // Un único `now` para todo el batch → mismo `created_at` para todas las filas
    // del import. Lo determinamos antes de la transacción para no variar dentro.
    const now = new Date().toISOString();
    return db.transaction(() => inputs.map((s) => insertOne(s, now)))();
  }

  function insertOne(input: CreateSaleInput, now: string): Sale {
    const result = insertStmt.run(
      input.product_name,
      input.buyer_name ?? null,
      input.cost_cents,
      input.price_cents,
      input.associated_costs_cents,
      input.sold ? 1 : 0,
      input.purchase_date ?? null,
      input.notes ?? null,
      now,
      input.sold_at ?? null,
    );
    const id = Number(result.lastInsertRowid);
    const row = getStmt.get(id) as SaleRow;
    return rowToSale(row);
  }

  function getById(id: number): Sale | null {
    const row = getStmt.get(id) as SaleRow | undefined;
    return row ? rowToSale(row) : null;
  }

  function list(filters: ListFilters = {}): Sale[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.sold !== undefined) {
      conditions.push('sold = ?');
      params.push(filters.sold ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters.offset ?? 0, 0);

    const sql = `SELECT * FROM sales ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const rows = db.prepare(sql).all(...params, limit, offset) as SaleRow[];
    return rows.map(rowToSale);
  }

  function update(id: number, input: UpdateSaleInput): Sale | null {
    const existing = getById(id);
    if (!existing) return null;

    // `UpdateSaleInput` define cada campo como `.nullable().optional()` (o `.optional()`):
    // ausencia (=`undefined`) = "no cambiar". `null` explícito = "borrar el valor".
    // Filtramos `undefined` antes del spread para no pisar el estado existente.
    const definedPatch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );

    const next: Sale = {
      ...existing,
      ...definedPatch,
      // Garantizamos que no se pisa `id` ni `created_at` aunque vengan en el patch.
      id: existing.id,
      created_at: existing.created_at,
    };

    // `sold_at` lo gestiona el cliente: si vino en el patch (incluso null), gana;
    // si no vino, queda como estaba. La coherencia `sold` ↔ `sold_at` la valida
    // Zod al parsear (ver `soldCoherenceRefine` en schemas/sales.ts).
    const soldAt = next.sold_at ?? null;

    db.prepare(
      `UPDATE sales SET
         product_name = ?,
         buyer_name = ?,
         cost_cents = ?,
         price_cents = ?,
         associated_costs_cents = ?,
         sold = ?,
         purchase_date = ?,
         notes = ?,
         sold_at = ?
       WHERE id = ?`,
    ).run(
      next.product_name,
      next.buyer_name ?? null,
      next.cost_cents,
      next.price_cents,
      next.associated_costs_cents,
      next.sold ? 1 : 0,
      next.purchase_date ?? null,
      next.notes ?? null,
      soldAt,
      id,
    );

    return getById(id);
  }

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  function stats(): SaleStats {
    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END), 0) AS sold,
           COALESCE(SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END), 0) AS not_sold,
           COALESCE(SUM(CASE WHEN sold = 1 THEN price_cents ELSE 0 END), 0) AS revenue_cents,
           COALESCE(SUM(cost_cents), 0) AS cost_cents,
           COALESCE(SUM(associated_costs_cents), 0) AS associated_costs_cents
         FROM sales`,
      )
      .get() as Omit<SaleStats, 'net_profit_cents'>;

    return {
      ...row,
      net_profit_cents: row.revenue_cents - row.cost_cents - row.associated_costs_cents,
    };
  }

  return { create, createMany, getById, list, update, remove, stats };
}
