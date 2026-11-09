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
describe('los tags en las compras por HTTP', () => {
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

  async function createTag(scope: 'buy' | 'sold', name: string): Promise<number> {
    const res = await api('POST', `/api/tags/${scope}`, { name, color: '#ff0000' });
    return (res.body?.data as { id: number }).id;
  }

  it('crea una compra con tag y lo devuelve en la respuesta', async () => {
    const tagId = await createTag('buy', 'Navidad');

    const res = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: tagId });

    expect(res.status).toBe(201);
    expect(res.body?.data).toMatchObject({
      tag: { id: tagId, name: 'Navidad', color: '#ff0000' },
    });
  });

  it('una compra sin tag tiene tag null', async () => {
    const res = await api('POST', '/api/buys', { product_name: 'Camiseta' });

    expect(res.status).toBe(201);
    expect((res.body?.data as { tag: unknown }).tag).toBeNull();
  });

  it('un tag inexistente responde 422', async () => {
    const res = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: 9999 });

    expect(res.status).toBe(422);
    expect(res.body?.error).toBe('El tag no existe');
  });

  it('un tag de otro ámbito responde 422', async () => {
    const soldTagId = await createTag('sold', 'Navidad');

    const res = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: soldTagId });

    expect(res.status).toBe(422);
    expect(res.body?.error).toBe('El tag no existe');
  });

  it('PATCH con tag_id null quita el tag de la compra', async () => {
    const tagId = await createTag('buy', 'Navidad');
    const created = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: tagId });
    const buyId = (created.body?.data as { id: number }).id;

    const res = await api('PATCH', `/api/buys/${buyId}`, { tag_id: null });

    expect(res.status).toBe(200);
    expect((res.body?.data as { tag: unknown }).tag).toBeNull();
  });

  it('PATCH sin tag_id no toca el tag existente', async () => {
    const tagId = await createTag('buy', 'Navidad');
    const created = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: tagId });
    const buyId = (created.body?.data as { id: number }).id;

    const res = await api('PATCH', `/api/buys/${buyId}`, { product_name: 'Zapatillas' });

    expect(res.status).toBe(200);
    expect(res.body?.data).toMatchObject({ tag: { id: tagId, name: 'Navidad' } });
  });

  it('filtra por tag_ids con semántica OR', async () => {
    const navidad = await createTag('buy', 'Navidad');
    const rebajas = await createTag('buy', 'Rebajas');
    await api('POST', '/api/buys', { product_name: 'A', tag_id: navidad });
    await api('POST', '/api/buys', { product_name: 'B', tag_id: rebajas });
    await api('POST', '/api/buys', { product_name: 'C' });

    const res = await api('GET', `/api/buys?tag_ids=${navidad},${rebajas}`);

    expect(res.status).toBe(200);
    const data = res.body?.data as Array<{ product_name: string }>;
    expect(data.map((b) => b.product_name).sort()).toEqual(['A', 'B']);
  });

  it('filtra por sin_tag', async () => {
    const navidad = await createTag('buy', 'Navidad');
    await api('POST', '/api/buys', { product_name: 'A', tag_id: navidad });
    await api('POST', '/api/buys', { product_name: 'B' });

    const res = await api('GET', '/api/buys?sin_tag=true');

    expect(res.status).toBe(200);
    const data = res.body?.data as Array<{ product_name: string }>;
    expect(data.map((b) => b.product_name)).toEqual(['B']);
  });

  it('sin_tag es excluyente: ignora los tag_ids enviados', async () => {
    const navidad = await createTag('buy', 'Navidad');
    await api('POST', '/api/buys', { product_name: 'A', tag_id: navidad });
    await api('POST', '/api/buys', { product_name: 'B' });

    const res = await api('GET', `/api/buys?tag_ids=${navidad}&sin_tag=true`);

    const data = res.body?.data as Array<{ product_name: string }>;
    expect(data.map((b) => b.product_name)).toEqual(['B']);
  });

  it('un tag_ids inválido responde 400', async () => {
    const res = await api('GET', '/api/buys?tag_ids=abc');

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('Parámetros inválidos');
  });

  it('borrar un tag deja sus compras sin tag y sin borrarlas', async () => {
    const tagId = await createTag('buy', 'Navidad');
    const created = await api('POST', '/api/buys', { product_name: 'Camiseta', tag_id: tagId });
    const buyId = (created.body?.data as { id: number }).id;

    const del = await api('DELETE', `/api/tags/buy/${tagId}`);
    expect(del.status).toBe(204);

    const get = await api('GET', `/api/buys/${buyId}`);
    expect(get.status).toBe(200);
    expect((get.body?.data as { tag: unknown }).tag).toBeNull();
  });
});
