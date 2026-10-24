import type { Database } from 'better-sqlite3';
import { definedOnly } from '../lib/defined-only.js';
import type { AssociatedSale, CascadeResult } from './types.js';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from '../schemas/customers.js';

interface CustomerRow {
  id: number;
  name: string;
  created_at: string;
}

interface CustomerWithMetricsRow extends CustomerRow {
  ventas: number;
  total_gastado: number;
}

interface CustomerWithMetrics extends Customer {
  ventas: number;
  total_gastado: number;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

function rowToCustomerWithMetrics(row: CustomerWithMetricsRow): CustomerWithMetrics {
  return {
    ...rowToCustomer(row),
    ventas: row.ventas,
    total_gastado: row.total_gastado,
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

export type RemoveCustomerResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_ASSOCIATED_SALES'; sales: AssociatedSale[] };

export interface CustomersRepo {
  create(input: CreateCustomerInput): Customer;
  getById(id: number): Customer | null;
  search(name: string): CustomerWithMetrics[];
  list(): CustomerWithMetrics[];
  update(id: number, input: UpdateCustomerInput): Customer | null;
  remove(id: number): RemoveCustomerResult;
  removeWithCascade(id: number): CascadeResult;
  listAssociatedSales(id: number): AssociatedSale[];
}

export function createCustomersRepo(db: Database): CustomersRepo {
  const insertStmt = db.prepare(`
    INSERT INTO customers (name, created_at) VALUES (?, ?)
  `);
  const getStmt = db.prepare('SELECT * FROM customers WHERE id = ?');
  const searchStmt = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           COUNT(s.id) AS ventas,
           COALESCE(SUM(s.sale_price), 0) AS total_gastado
    FROM customers c
    LEFT JOIN solds s ON s.customer_id = c.id
    WHERE c.name LIKE ? ESCAPE '!'
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
    LIMIT 20
  `);
  const listStmt = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           COUNT(s.id) AS ventas,
           COALESCE(SUM(s.sale_price), 0) AS total_gastado
    FROM customers c
    LEFT JOIN solds s ON s.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `);
  const deleteStmt = db.prepare('DELETE FROM customers WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE customers SET name = ? WHERE id = ?
  `);
  const listAssociatedSalesStmt = db.prepare(`
    SELECT s.id, c.name AS customer_name, s.sold_at,
            COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.sold_id = s.id), 0) AS items_count
    FROM solds s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.customer_id = ?
    ORDER BY s.id DESC
  `);
  const deleteSalesStmt = db.prepare(`DELETE FROM solds WHERE customer_id = ?`);

  function create(input: CreateCustomerInput): Customer {
    const now = new Date().toISOString();
    const result = insertStmt.run(input.name, now);
    const id = Number(result.lastInsertRowid);
    return rowToCustomer(getStmt.get(id) as CustomerRow);
  }

  function getById(id: number): Customer | null {
    const row = getStmt.get(id) as CustomerRow | undefined;
    return row ? rowToCustomer(row) : null;
  }

  function search(name: string): CustomerWithMetrics[] {
    const pattern = `%${escapeLikePattern(name)}%`;
    const rows = searchStmt.all(pattern) as CustomerWithMetricsRow[];
    return rows.map(rowToCustomerWithMetrics);
  }

  function list(): CustomerWithMetrics[] {
    const rows = listStmt.all() as CustomerWithMetricsRow[];
    return rows.map(rowToCustomerWithMetrics);
  }

  function update(id: number, input: UpdateCustomerInput): Customer | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = definedOnly(input);
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = { ...existing, ...definedPatch };
    updateStmt.run(next.name, id);
    return getById(id);
  }

  function listAssociatedSales(id: number): AssociatedSale[] {
    return listAssociatedSalesStmt.all(id) as AssociatedSale[];
  }

  function remove(id: number): RemoveCustomerResult {
    return db.transaction((): RemoveCustomerResult => {
      const existing = getStmt.get(id) as CustomerRow | undefined;
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
      deleteSalesStmt.run(id);
      if (deleteStmt.run(id).changes === 0) return { ok: false, code: 'NOT_FOUND' };
      return { ok: true };
    })();
  }

  return {
    create,
    getById,
    search,
    list,
    update,
    remove,
    removeWithCascade,
    listAssociatedSales,
  };
}
