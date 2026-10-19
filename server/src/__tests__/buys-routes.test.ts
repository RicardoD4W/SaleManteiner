/**
 * Tests del CONTRATO HTTP de las rutas de buys (S10 del feature
 * `delete-cascade-and-ux-polish`).
 *
 * Por qué existe: los tests del server son a nivel repo (en este repo no
 * hay supertest), así que el mapeo de la ruta a status/body —el 409 con
 * `associated_sales`, el 404, el 400 y el orden de `/:id/cascade` antes de
 * `/:id`— no estaba pinneado en ningún lado. Este test levanta la app real
 * (Express, con los routers montados) sobre una BD `:memory:` y habla HTTP
 * con `fetch`, o sea que verifica lo que el cliente ve, no internos.
 *
 * Los imports son dinámicos a propósito: las variables de entorno tienen que
 * estar seteadas ANTES de que se cargue `logger.ts` (pino), que se evalúa en
 * el import. Con `LOG_LEVEL=silent` y `NODE_ENV=production` (sin transport)
 * el test no ensucia la salida.
 */
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

type Repos = {
  buys: ReturnType<typeof createBuysRepo>;
  solds: ReturnType<typeof createSoldsRepo>;
  customers: ReturnType<typeof createCustomersRepo>;
};

describe('contrato HTTP del borrado de compras', () => {
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
    db.close();
  });

  /** Helper HTTP: devuelve status + body parseado (null si no hay body). */
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

  function seedBuy(product_name: string, quantity = 5) {
    return repos.buys.create({
      product_name,
      purchase_cost: 50,
      quantity,
      associated_costs: 0,
    });
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
      sold_at: '2026-10-19',
      items,
    });
  }

  describe('DELETE /api/buys/:id', () => {
    it('compra sin ventas: 204 y la compra deja de existir', async () => {
      const buy = seedBuy('Sin ventas');

      const del = await api('DELETE', `/api/buys/${buy.id}`);

      expect(del.status).toBe(204);
      expect(del.body).toBeNull();
      const get = await api('GET', `/api/buys/${buy.id}`);
      expect(get.status).toBe(404);
    });

    it('compra con ventas: 409 con error + associated_sales, y la compra sigue existiendo', async () => {
      const buy = seedBuy('Con ventas', 5);
      const customer = seedCustomer('Ana');
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 2 }]);

      const del = await api('DELETE', `/api/buys/${buy.id}`);

      expect(del.status).toBe(409);
      expect(del.body).toEqual({
        error:
          'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?',
        associated_sales: [
          {
            id: sale.id,
            customer_name: 'Ana',
            sold_at: '2026-10-19',
            items_count: 2,
          },
        ],
      });

      // La compra NO se borra (el 409 es una negativa, no un borrado parcial).
      const get = await api('GET', `/api/buys/${buy.id}`);
      expect(get.status).toBe(200);
    });

    it('items_count cuenta solo las unidades de ESE buy dentro de un pack', async () => {
      const buyA = seedBuy('Pack A', 5);
      const buyB = seedBuy('Pack B', 5);
      const customer = seedCustomer('Beto');
      const sale = seedSale(customer.id, [
        { buy_id: buyA.id, quantity: 3 },
        { buy_id: buyB.id, quantity: 1 },
      ]);

      const del = await api('DELETE', `/api/buys/${buyA.id}`);

      expect(del.status).toBe(409);
      expect(del.body?.associated_sales).toEqual([
        {
          id: sale.id,
          customer_name: 'Beto',
          sold_at: '2026-10-19',
          items_count: 3,
        },
      ]);
    });

    it('id inexistente: 404 con "Compra no encontrada"', async () => {
      const del = await api('DELETE', '/api/buys/9999');

      expect(del.status).toBe(404);
      expect(del.body).toEqual({ error: 'Compra no encontrada', id: 9999 });
    });

    it('id no numérico: 400 con "Id inválido"', async () => {
      const del = await api('DELETE', '/api/buys/abc');

      expect(del.status).toBe(400);
      expect(del.body?.error).toBe('Id inválido');
    });
  });

  describe('DELETE /api/buys/:id/cascade', () => {
    it('venta de un solo item: 204, la compra y la venta desaparecen', async () => {
      const buy = seedBuy('Cascada simple', 3);
      const customer = seedCustomer('Carla');
      const sale = seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);

      const del = await api('DELETE', `/api/buys/${buy.id}/cascade`);

      expect(del.status).toBe(204);
      expect(del.body).toBeNull();
      expect((await api('GET', `/api/buys/${buy.id}`)).status).toBe(404);
      expect((await api('GET', `/api/solds/${sale.id}`)).status).toBe(404);
    });

    it('pack: la venta sobrevive y queda solo con el item que no es de esta compra', async () => {
      const buyA = seedBuy('Cascada A', 5);
      const buyB = seedBuy('Cascada B', 5);
      const customer = seedCustomer('Dani');
      const sale = seedSale(customer.id, [
        { buy_id: buyA.id, quantity: 1 },
        { buy_id: buyB.id, quantity: 2 },
      ]);

      const del = await api('DELETE', `/api/buys/${buyA.id}/cascade`);

      expect(del.status).toBe(204);
      expect((await api('GET', `/api/buys/${buyA.id}`)).status).toBe(404);
      // La venta sigue viva con el item de buyB.
      const get = await api('GET', `/api/solds/${sale.id}`);
      expect(get.status).toBe(200);
      const data = get.body?.data as { items: Array<{ buy_id: number; quantity: number }> };
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({ buy_id: buyB.id, quantity: 2 });
    });

    it('el path /:id/cascade lo maneja la ruta cascade, no se interpreta como un id', async () => {
      // En Express 5 el parámetro `:id` no matchea segmentos con '/', así que
      // '/5/cascade' no puede caer en la ruta `/:id`. Este test lo verifica
      // por HTTP: si la ruta cascade no existiera (o el path se interpretara
      // como id), la respuesta sería 404/400 y no 204.
      const buy = seedBuy('Path de la ruta cascade', 2);
      const customer = seedCustomer('Eva');
      seedSale(customer.id, [{ buy_id: buy.id, quantity: 1 }]);

      const del = await api('DELETE', `/api/buys/${buy.id}/cascade`);

      expect(del.status).toBe(204);
    });

    it('id no numérico en la ruta cascade: 400 con "Id inválido"', async () => {
      const del = await api('DELETE', '/api/buys/abc/cascade');

      expect(del.status).toBe(400);
      expect(del.body?.error).toBe('Id inválido');
    });

    it('id inexistente: 404 con "Compra no encontrada"', async () => {
      const del = await api('DELETE', '/api/buys/9999/cascade');

      expect(del.status).toBe(404);
      expect(del.body).toEqual({ error: 'Compra no encontrada', id: 9999 });
    });
  });
});
