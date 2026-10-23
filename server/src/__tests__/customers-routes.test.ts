process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createSoldsRepo } = await import('../repo/solds-repo.js');
const { createCustomersRepo } = await import('../repo/customers-repo.js');
const { createApp } = await import('../app.js');
const { logger } = await import('../logger.js');

type Repos = {
  buys: ReturnType<typeof createBuysRepo>;
  solds: ReturnType<typeof createSoldsRepo>;
  customers: ReturnType<typeof createCustomersRepo>;
};

describe('contrato HTTP del borrado de clientes', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;
  let repos: Repos;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    repos = {
      buys: createBuysRepo(db),
      solds: createSoldsRepo(db),
      customers: createCustomersRepo(db),
    };
    const app = createApp({
      buysRepo: repos.buys,
      soldsRepo: repos.solds,
      customersRepo: repos.customers,
    });
    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    vi.restoreAllMocks();
    db.close();
  });

  async function api(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: Record<string, unknown> | null }> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    };
  }

  function seedCustomer(name: string) {
    return repos.customers.create({ name });
  }

  function seedSale(
    customer_id: number,
    items: Array<{ buy_id: number; quantity: number }>,
    sale_price = 100,
  ) {
    return repos.solds.createManyWithStockCheck({
      customer_id,
      sale_price,
      associated_costs: 0,
      sold_at: '2026-10-20',
      items,
    });
  }

  function count(sql: string, ...args: unknown[]): number {
    return (db.prepare(sql).get(...args) as { c: number }).c;
  }

  describe('DELETE /api/customers/:id', () => {
    it('cliente sin ventas: 204 y el cliente deja de existir', async () => {
      const customer = seedCustomer('Sin ventas');

      const del = await api('DELETE', `/api/customers/${customer.id}`);

      expect(del.status).toBe(204);
      expect(del.body).toBeNull();
      const get = await api('GET', `/api/customers/${customer.id}`);
      expect(get.status).toBe(404);
    });

    it('cliente con ventas: 409 con error + associated_sales, y NO se borra nada', async () => {
      const customer = seedCustomer('Ana');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 2 }]);

      const del = await api('DELETE', `/api/customers/${customer.id}`);

      expect(del.status).toBe(409);
      expect(del.body).toEqual({
        error:
          'No se puede borrar: el cliente tiene ventas asociadas. ¿Querés borrar también las ventas?',
        associated_sales: [
          {
            id: sale.id,
            customer_name: 'Ana',
            sold_at: '2026-10-20',
            items_count: 2,
          },
        ],
      });

      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${sale.id}`)).status).toBe(200);
      expect(count('SELECT COUNT(*) AS c FROM customers WHERE id = ?', customer.id)).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM solds WHERE id = ?', sale.id)).toBe(1);
    });

    it('cliente con varias ventas: 409 las lista todas y ninguna se borra', async () => {
      const customer = seedCustomer('Nora');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale1 = seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }], 100);
      const sale2 = seedSale(customer.id, [{ buy_id: buy.id, quantity: 2 }], 200);

      const del = await api('DELETE', `/api/customers/${customer.id}`);

      expect(del.status).toBe(409);
      expect(del.body?.associated_sales).toEqual([
        {
          id: sale2.id,
          customer_name: 'Nora',
          sold_at: '2026-10-20',
          items_count: 2,
        },
        {
          id: sale1.id,
          customer_name: 'Nora',
          sold_at: '2026-10-20',
          items_count: 1,
        },
      ]);

      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${sale1.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${sale2.id}`)).status).toBe(200);
    });

    it('las ventas de otro cliente no bloquean el borrado', async () => {
      const withSales = seedCustomer('Con ventas');
      const other = seedCustomer('Beto');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      seedSale(withSales.id, [{ buy_id: buy.id, quantity: 1 }]);

      const del = await api('DELETE', `/api/customers/${other.id}`);

      expect(del.status).toBe(204);
      expect((await api('GET', `/api/customers/${other.id}`)).status).toBe(404);
    });

    it('id inexistente: 404 con "Cliente no encontrado"', async () => {
      const del = await api('DELETE', '/api/customers/9999');

      expect(del.status).toBe(404);
      expect(del.body).toEqual({ error: 'Cliente no encontrado', id: 9999 });
    });

    it('id no numérico: 400 con "Id inválido"', async () => {
      const del = await api('DELETE', '/api/customers/abc');

      expect(del.status).toBe(400);
      expect(del.body?.error).toBe('Id inválido');
    });
  });

  describe('DELETE /api/customers/:id/cascade', () => {
    it('borra el cliente, sus ventas y sus items: 204', async () => {
      const customer = seedCustomer('Ana');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 2 }]);

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(204);
      expect(del.body).toBeNull();
      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(404);
      expect((await api('GET', `/api/solds/${sale.id}`)).status).toBe(404);
      expect(count('SELECT COUNT(*) AS c FROM customers WHERE id = ?', customer.id)).toBe(0);
      expect(count('SELECT COUNT(*) AS c FROM solds WHERE id = ?', sale.id)).toBe(0);
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', sale.id)).toBe(0);
      expect((await api('GET', `/api/buys/${buy.id}`)).status).toBe(200);
    });

    it('no toca las ventas de otros clientes', async () => {
      const customer = seedCustomer('Ana');
      const other = seedCustomer('Beto');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const mine = seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);
      const otherSale = seedSale(other.id, [{ buy_id: buy.id, quantity: 1 }]);

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(204);
      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(404);
      expect((await api('GET', `/api/solds/${mine.id}`)).status).toBe(404);
      expect((await api('GET', `/api/customers/${other.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${otherSale.id}`)).status).toBe(200);
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', otherSale.id)).toBe(1);
    });

    it('el path /:id/cascade lo maneja la ruta cascade, no se interpreta como un id', async () => {
      const customer = seedCustomer('Eva');

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(204);
    });

    it('id no numérico en la ruta cascade: 400 con "Id inválido"', async () => {
      const del = await api('DELETE', '/api/customers/abc/cascade');

      expect(del.status).toBe(400);
      expect(del.body?.error).toBe('Id inválido');
    });

    it('id inexistente: 404 con "Cliente no encontrado"', async () => {
      const del = await api('DELETE', '/api/customers/9999/cascade');

      expect(del.status).toBe(404);
      expect(del.body).toEqual({ error: 'Cliente no encontrado', id: 9999 });
    });
  });

  describe('audit trail del cascade', () => {
    it('el borrado en cascada deja registro con el cliente y las ventas afectadas', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const customer = seedCustomer('Fede');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 2 }]);

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(204);
      expect(warn).toHaveBeenCalledTimes(1);
      const [payload] = warn.mock.calls[0] as [{ customer_id: number; affected_sales: unknown[] }];
      expect(payload.customer_id).toBe(customer.id);
      expect(payload.affected_sales).toEqual([
        { id: sale.id, customer_name: 'Fede', items_count: 2 },
      ]);
    });

    it('el registro se escribe ANTES del borrado (write-ahead)', async () => {
      let existedAtLogTime: boolean | null = null;
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {
        existedAtLogTime =
          (
            db.prepare('SELECT COUNT(*) AS c FROM customers WHERE id = ?').get(customerId) as {
              c: number;
            }
          ).c > 0;
      });
      const customer = seedCustomer('Huma');
      const customerId = customer.id;
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(204);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(existedAtLogTime).toBe(true);
    });

    it('si el borrado falla, queda registrado que no se completó', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      const customer = seedCustomer('Inés');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);
      db.exec(
        `CREATE TRIGGER block_sold_delete BEFORE DELETE ON solds
         BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
      );

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(500);
      expect(warn).toHaveBeenCalledTimes(1);
      const errorPayloads = error.mock.calls.map((c) => c[0] as { customer_id?: number });
      expect(errorPayloads.some((p) => p.customer_id === customer.id)).toBe(true);
      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${sale.id}`)).status).toBe(200);
    });

    it('no deja registro si el borrado no ocurrió (409 por ventas y 404 por inexistente)', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const customer = seedCustomer('Gina');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);

      expect((await api('DELETE', `/api/customers/${customer.id}`)).status).toBe(409);
      expect((await api('DELETE', '/api/customers/9999/cascade')).status).toBe(404);

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('atomicidad del cascade', () => {
    it('si el borrado falla a mitad de camino, no queda nada a medias', async () => {
      const customer = seedCustomer('Huma');
      const buy = repos.buys.create({
        product_name: 'Camiseta',
        purchase_cost: 20,
        quantity: 5,
        associated_costs: 0,
      });
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);
      db.exec(
        `CREATE TRIGGER block_sold_delete BEFORE DELETE ON solds
         BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
      );

      const del = await api('DELETE', `/api/customers/${customer.id}/cascade`);

      expect(del.status).toBe(500);
      expect((await api('GET', `/api/customers/${customer.id}`)).status).toBe(200);
      expect((await api('GET', `/api/solds/${sale.id}`)).status).toBe(200);
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', sale.id)).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM customers WHERE id = ?', customer.id)).toBe(1);
    });
  });

  describe('GET /api/customers', () => {
    it('sin parámetros devuelve todos los clientes', async () => {
      seedCustomer('Ana');
      seedCustomer('Beto');

      const res = await api('GET', '/api/customers');

      expect(res.status).toBe(200);
      expect((res.body?.data as unknown[]).length).toBe(2);
    });

    it('con ?name filtra por nombre', async () => {
      seedCustomer('Ana');
      seedCustomer('Beto');

      const res = await api('GET', '/api/customers?name=Ana');

      expect(res.status).toBe(200);
      expect((res.body?.data as unknown[]).length).toBe(1);
    });

    it('con un parámetro desconocido devuelve 400 en vez de ignorarlo', async () => {
      seedCustomer('Ana');

      const res = await api('GET', '/api/customers?q=Ana');

      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('Parámetros inválidos');
    });
  });
});
