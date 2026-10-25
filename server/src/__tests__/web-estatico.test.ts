process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createSoldsRepo } = await import('../repo/solds-repo.js');
const { createCustomersRepo } = await import('../repo/customers-repo.js');
const { createApp } = await import('../app.js');

const INDEX_HTML = '<!doctype html><html><body><div id="root">sale</div></body></html>';

describe('el server sirve el web compilado (un solo origen)', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;
  let webDir: string;

  beforeEach(async () => {
    webDir = mkdtempSync(path.join(tmpdir(), 'salemanteiner-web-'));
    mkdirSync(path.join(webDir, 'assets'));
    writeFileSync(path.join(webDir, 'index.html'), INDEX_HTML);
    writeFileSync(path.join(webDir, 'assets', 'app.js'), 'export const ok = true;');

    db = openDb(':memory:');
    runMigrations(db);
    const app = createApp({
      buysRepo: createBuysRepo(db),
      soldsRepo: createSoldsRepo(db),
      customersRepo: createCustomersRepo(db),
      webDir,
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
    rmSync(webDir, { recursive: true, force: true });
    db.close();
  });

  it('GET / devuelve el index.html del web compilado', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('sale');
  });

  it('GET /buys (ruta del SPA) devuelve el index.html', async () => {
    const res = await fetch(`${baseUrl}/buys`, { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('sale');
  });

  it('GET /solds y /customers también (deep links)', async () => {
    for (const ruta of ['/solds', '/customers', '/revenue']) {
      const res = await fetch(`${baseUrl}${ruta}`, { headers: { Accept: 'text/html' } });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('sale');
    }
  });

  it('GET /assets/app.js sirve el archivo estático', async () => {
    const res = await fetch(`${baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('export const ok');
  });

  it('la API no se ve afectada: /api/health sigue siendo JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  it('una ruta de API inexistente sigue dando 404 JSON (no el index)', async () => {
    const res = await fetch(`${baseUrl}/api/no-existe`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('Not Found');
  });

  it('una ruta con extensión que no existe da 404 JSON, no HTML', async () => {
    const res = await fetch(`${baseUrl}/lo-que-sea.json`, { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('sin web compilado el server se comporta como antes (404 JSON)', async () => {
    const app = createApp({
      buysRepo: createBuysRepo(db),
      soldsRepo: createSoldsRepo(db),
      customersRepo: createCustomersRepo(db),
      webDir: null,
    });
    const isolated = app.listen(0);
    await once(isolated, 'listening');
    const { port } = isolated.address() as AddressInfo;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { headers: { Accept: 'text/html' } });
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
    } finally {
      await new Promise<void>((resolve) => {
        isolated.close(() => resolve());
      });
    }
  });
});
