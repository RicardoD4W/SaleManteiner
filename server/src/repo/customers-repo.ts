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

/**
 * Venta asociada a un cliente (para el 409 del DELETE de customers).
 */
export interface AssociatedSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  /** Total de unidades vendidas en la venta (SUM de sale_items.quantity). */
  items_count: number;
}

/**
 * Resultado discriminado de `CustomersRepo.remove`.
 *  - `{ ok: true }`: el cliente no tenía ventas asociadas y se borró.
 *  - `{ ok: false, code: 'NOT_FOUND' }`: el id no existe.
 *  - `{ ok: false, code: 'HAS_ASSOCIATED_SALES', sales }`: el cliente tiene
 *    ventas vinculadas. La ruta mapea este caso a 409 con el body
 *    `{ error, associated_sales: sales }`.
 */
export type RemoveCustomerResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_ASSOCIATED_SALES'; sales: AssociatedSale[] };

export interface CustomersRepo {
  create(input: CreateCustomerInput): Customer;
  getById(id: number): Customer | null;
  /** Búsqueda parcial por nombre (para autocomplete). Case-insensitive LIKE. */
  search(name: string): Customer[];
  list(): Customer[];
  update(id: number, input: UpdateCustomerInput): Customer | null;
  /**
   * Borra un cliente. Si tiene ventas asociadas (solds.customer_id
   * ON DELETE RESTRICT) NO lo borra y devuelve
   * `{ ok: false, code: 'HAS_ASSOCIATED_SALES', sales }` para que la UI
   * pueda pedir confirmación. Si el id no existe → `NOT_FOUND`.
   */
  remove(id: number): RemoveCustomerResult;
  /**
   * Borra un cliente EN CASCADA: el cliente, sus ventas y los `sale_items`
   * de esas ventas (que caen por ON DELETE CASCADE del FK sold_id), todo
   * dentro de una transacción. Devuelve `true` si el cliente existía y se
   * borró, `false` si no existía. La ruta mapea este método a
   * `DELETE /api/customers/:id/cascade`.
   */
  removeWithCascade(id: number): boolean;
  /**
   * Lista las ventas de este cliente (con `customer_name`, `sold_at` y
   * `items_count`). La ruta la usa para el body del 409 y para el audit
   * trail del borrado en cascada: como la cascada no tiene undo, el server
   * deja registro de qué ventas se eliminaron.
   */
  listAssociatedSales(id: number): AssociatedSale[];
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

  function listAssociatedSales(id: number): AssociatedSale[] {
    return db
      .prepare(
        `SELECT s.id, c.name AS customer_name, s.sold_at,
                COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.sold_id = s.id), 0) AS items_count
         FROM solds s
         JOIN customers c ON c.id = s.customer_id
         WHERE s.customer_id = ?
         ORDER BY s.id DESC`,
      )
      .all(id) as AssociatedSale[];
  }

  function remove(id: number): RemoveCustomerResult {
    return db.transaction((): RemoveCustomerResult => {
      const existing = getStmt.get(id) as CustomerRow | undefined;
      if (!existing) return { ok: false, code: 'NOT_FOUND' };
      const sales = listAssociatedSales(id);
      if (sales.length > 0) {
        // El FK solds.customer_id ON DELETE RESTRICT bloquearía el DELETE
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
      const existing = getStmt.get(id) as CustomerRow | undefined;
      if (!existing) return false;
      // Primero las ventas: los `sale_items` de esas ventas caen solos por
      // ON DELETE CASCADE del FK sold_id. Después el cliente (que, con las
      // ventas ya borradas, no tiene nada que lo bloquee por el FK RESTRICT).
      const deleteSalesStmt = db.prepare(`DELETE FROM solds WHERE customer_id = ?`);
      deleteSalesStmt.run(id);
      return deleteStmt.run(id).changes > 0;
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
