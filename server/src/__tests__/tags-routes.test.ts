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
describe('contrato HTTP de los tags', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    const customersRepo = createCustomersRepo(db);
    const app = createApp({
      buysRepo: createBuysRepo(db),
      soldsRepo: createSoldsRepo(db),
      customersRepo,
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

  it('GET /api/tags/buy devuelve la lista del catálogo de compras', async () => {
    const res = await api('GET', '/api/tags/buy');

    expect(res.status).toBe(200);
    expect(res.body?.data).toEqual([]);
  });

  it('POST /api/tags/buy crea el tag y responde 201', async () => {
    const res = await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });

    expect(res.status).toBe(201);
    expect(res.body?.data).toMatchObject({ scope: 'buy', name: 'Navidad', color: '#ff0000' });
  });

  it('POST con nombre duplicado responde 409', async () => {
    await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });

    const res = await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#00ff00' });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe('Ya existe un tag con ese nombre');
  });

  it('POST con color inválido responde 400', async () => {
    const res = await api('POST', '/api/tags/buy', { name: 'Navidad', color: 'rojo' });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('Datos de tag inválidos');
  });

  it('PATCH actualiza el color y devuelve el tag', async () => {
    const created = await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });
    const id = (created.body?.data as { id: number }).id;

    const res = await api('PATCH', `/api/tags/buy/${id}`, { color: '#00ff00' });

    expect(res.status).toBe(200);
    expect(res.body?.data).toMatchObject({ color: '#00ff00', name: 'Navidad' });
  });

  it('PATCH de un tag inexistente responde 404', async () => {
    const res = await api('PATCH', '/api/tags/buy/9999', { color: '#00ff00' });

    expect(res.status).toBe(404);
    expect(res.body?.error).toBe('El tag no existe');
  });

  it('PATCH con nombre duplicado responde 409', async () => {
    await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });
    const other = await api('POST', '/api/tags/buy', { name: 'Rebajas', color: '#0000ff' });
    const id = (other.body?.data as { id: number }).id;

    const res = await api('PATCH', `/api/tags/buy/${id}`, { name: 'Navidad' });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe('Ya existe un tag con ese nombre');
  });

  it('DELETE borra el tag y responde 204', async () => {
    const created = await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });
    const id = (created.body?.data as { id: number }).id;

    const res = await api('DELETE', `/api/tags/buy/${id}`);

    expect(res.status).toBe(204);
    expect((await api('GET', '/api/tags/buy')).body?.data).toEqual([]);
  });

  it('DELETE de un tag inexistente responde 404', async () => {
    const res = await api('DELETE', '/api/tags/buy/9999');

    expect(res.status).toBe(404);
    expect(res.body?.error).toBe('El tag no existe');
  });

  it('los catálogos de compras y ventas son independientes', async () => {
    await api('POST', '/api/tags/buy', { name: 'Navidad', color: '#ff0000' });

    const sold = await api('POST', '/api/tags/sold', { name: 'Navidad', color: '#00ff00' });

    expect(sold.status).toBe(201);
    expect((await api('GET', '/api/tags/sold')).body?.data).toHaveLength(1);
  });
});
