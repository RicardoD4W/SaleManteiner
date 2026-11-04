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

describe('contrato HTTP de /api/stats/metrics', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    const app = createApp({
      buysRepo: createBuysRepo(db),
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

  it('devuelve las métricas con la forma acordada', async () => {
    const res = await fetch(`${baseUrl}/api/stats/metrics`);
    const body = (await res.json()) as {
      data: {
        kpis: Record<string, number>;
        mes_actual: { month: string; margen_pct: number };
        mes_anterior: { month: string };
        variaciones: unknown;
        margen_productos: unknown[];
        deudores: unknown[];
        gastos_categoria: unknown[];
      };
    };

    expect(res.status).toBe(200);
    expect(body.data.kpis.margen_pct).toBe(0);
    expect(body.data.kpis.ventas_count).toBe(0);
    expect(body.data.mes_actual.month).toMatch(/^\d{4}-\d{2}$/);
    expect(body.data.mes_anterior.month).toMatch(/^\d{4}-\d{2}$/);
    expect(body.data.variaciones).toBeNull();
    expect(body.data.margen_productos).toEqual([]);
    expect(body.data.deudores).toEqual([]);
    expect(body.data.gastos_categoria).toEqual([]);
  });
});
