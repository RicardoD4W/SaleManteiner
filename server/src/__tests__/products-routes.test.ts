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
const { CreateBuyInput } = await import('../schemas/buys.js');

function createBuy(repo: ReturnType<typeof createBuysRepo>, product_name: string) {
  return repo.create(CreateBuyInput.parse({ product_name }));
}

describe('contrato HTTP de los nombres de producto', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;
  let buys: ReturnType<typeof createBuysRepo>;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    buys = createBuysRepo(db);
    const app = createApp({
      buysRepo: buys,
      soldsRepo: createSoldsRepo(db),
      customersRepo: createCustomersRepo(db),
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

  it('devuelve los nombres de producto con su número de usos', async () => {
    createBuy(buys, 'iPhone 12');
    createBuy(buys, 'Funda');
    createBuy(buys, 'iPhone 12');

    const res = await fetch(`${baseUrl}/api/products`);
    const body = (await res.json()) as { data: Array<{ name: string; uses: number }> };

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      { name: 'iPhone 12', uses: 2 },
      { name: 'Funda', uses: 1 },
    ]);
  });

  it('devuelve una lista vacía cuando no hay compras', async () => {
    const res = await fetch(`${baseUrl}/api/products`);
    const body = (await res.json()) as { data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });
});
