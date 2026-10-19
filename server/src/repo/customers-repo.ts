import type { Database } from 'better-sqlite3';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from '../schemas/customers.js';

interface CustomerRow {
  id: number;
  name: string;
  created_at: string;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

export interface CustomersRepo {
  create(input: CreateCustomerInput): Customer;
  getById(id: number): Customer | null;
  /** Búsqueda parcial por nombre (para autocomplete). Case-insensitive LIKE. */
  search(name: string): Customer[];
  list(): Customer[];
  update(id: number, input: UpdateCustomerInput): Customer | null;
  remove(id: number): boolean;
}

export function createCustomersRepo(db: Database): CustomersRepo {
  const insertStmt = db.prepare(`
    INSERT INTO customers (name, created_at) VALUES (?, ?)
  `);
  const getStmt = db.prepare('SELECT * FROM customers WHERE id = ?');
  const searchStmt = db.prepare(`
    SELECT * FROM customers WHERE name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 20
  `);
  const listStmt = db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE');
  const deleteStmt = db.prepare('DELETE FROM customers WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE customers SET name = ? WHERE id = ?
  `);

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

  function search(name: string): Customer[] {
    const pattern = `%${name}%`;
    const rows = searchStmt.all(pattern) as CustomerRow[];
    return rows.map(rowToCustomer);
  }

  function list(): Customer[] {
    const rows = listStmt.all() as CustomerRow[];
    return rows.map(rowToCustomer);
  }

  function update(id: number, input: UpdateCustomerInput): Customer | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = { ...existing, ...definedPatch };
    updateStmt.run(next.name, id);
    return getById(id);
  }

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  return { create, getById, search, list, update, remove };
}
