process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';
import { createRequire } from 'node:module';

const { version: SERVER_VERSION } = createRequire(import.meta.url)('../../package.json') as {
  version: string;
};

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createSoldsRepo } = await import('../repo/solds-repo.js');
const { createCustomersRepo } = await import('../repo/customers-repo.js');
const { createApp } = await import('../app.js');

describe('GET /api/version', () => {
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
      webDir: null,
    });
    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    delete process.env.SALE_MANTEINER_APP_VERSION;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    db.close();
  });

  it('devuelve la versión del back (la de su package.json)', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { app: string; front: string; back: string };
    expect(body.back).toBe(SERVER_VERSION);
  });

  it('devuelve las tres versiones y ninguna vacía', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    const body = (await res.json()) as { app: string; front: string; back: string };
    expect(body.app.length).toBeGreaterThan(0);
    expect(body.front.length).toBeGreaterThan(0);
    expect(body.back.length).toBeGreaterThan(0);
  });

  it('el shell puede forzar la versión de la app por entorno', async () => {
    process.env.SALE_MANTEINER_APP_VERSION = '9.9.9';
    const res = await fetch(`${baseUrl}/api/version`);
    const body = (await res.json()) as { app: string };
    expect(body.app).toBe('9.9.9');
  });
});
