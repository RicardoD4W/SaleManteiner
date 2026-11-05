process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createSoldsRepo } = await import('../repo/solds-repo.js');
const { createCustomersRepo } = await import('../repo/customers-repo.js');
const { createBackupService } = await import('../backup/backup-service.js');
const { createApp } = await import('../app.js');

describe('contrato HTTP de /api/backups', () => {
  let dir: string;
  let db: Database;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'salemanteiner-backups-http-'));
    db = openDb(join(dir, 'data.db'));
    runMigrations(db);
    const backupService = createBackupService({ db, dbPath: join(dir, 'data.db') });
    const app = createApp({
      buysRepo: createBuysRepo(db),
      soldsRepo: createSoldsRepo(db),
      customersRepo: createCustomersRepo(db),
      backupService,
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
    rmSync(dir, { recursive: true, force: true });
  });

  function customerNames(): string[] {
    return (
      db.prepare('SELECT name FROM customers ORDER BY id').all() as Array<{ name: string }>
    ).map((row) => row.name);
  }

  it('crea, lista, descarga y elimina copias', async () => {
    const empty = await fetch(`${baseUrl}/api/backups`);
    expect(empty.status).toBe(200);
    expect(((await empty.json()) as { data: unknown[] }).data).toEqual([]);

    const created = await fetch(`${baseUrl}/api/backups`, { method: 'POST' });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { data: { name: string; size: number } };
    expect(createdBody.data.name).toMatch(/^salemanteiner-\d{8}-\d{6}(-\d+)?\.db$/);
    expect(createdBody.data.size).toBeGreaterThan(0);

    const list = await fetch(`${baseUrl}/api/backups`);
    const listBody = (await list.json()) as { data: Array<{ name: string }> };
    expect(listBody.data).toHaveLength(1);

    const download = await fetch(`${baseUrl}/api/backups/${createdBody.data.name}/download`);
    expect(download.status).toBe(200);
    const bytes = Buffer.from(await download.arrayBuffer());
    expect(bytes.subarray(0, 15).toString('utf-8')).toBe('SQLite format 3');

    const removed = await fetch(`${baseUrl}/api/backups/${createdBody.data.name}`, {
      method: 'DELETE',
    });
    expect(removed.status).toBe(204);

    const afterRemove = await fetch(`${baseUrl}/api/backups`);
    expect(((await afterRemove.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it('devuelve 404 al descargar o borrar una copia que no existe', async () => {
    const download = await fetch(`${baseUrl}/api/backups/no-existe.db/download`);
    expect(download.status).toBe(404);

    const removed = await fetch(`${baseUrl}/api/backups/no-existe.db`, { method: 'DELETE' });
    expect(removed.status).toBe(404);
  });

  it('rechaza con 400 un archivo que no es una copia y no toca los datos', async () => {
    db.prepare('INSERT INTO customers (name, created_at) VALUES (?, ?)').run('Ana', '2026-01-01');

    const res = await fetch(`${baseUrl}/api/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'basura.db' },
      body: Buffer.from('esto no es una base de datos'),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/válida|dañado/i);
    expect(customerNames()).toEqual(['Ana']);
  });

  it('restaura una copia subida por el usuario', async () => {
    db.prepare('INSERT INTO customers (name, created_at) VALUES (?, ?)').run('Ana', '2026-01-01');

    const created = await fetch(`${baseUrl}/api/backups`, { method: 'POST' });
    const createdBody = (await created.json()) as { data: { name: string } };
    const bytes = readFileSync(join(dir, 'backups', createdBody.data.name));

    db.prepare('INSERT INTO customers (name, created_at) VALUES (?, ?)').run('Beto', '2026-01-02');
    expect(customerNames()).toEqual(['Ana', 'Beto']);

    const res = await fetch(`${baseUrl}/api/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'copia.db' },
      body: bytes,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { customers: number; safety_backup: string };
    };
    expect(body.data.customers).toBe(1);
    expect(body.data.safety_backup).toMatch(/^pre-restauracion-/);
    expect(customerNames()).toEqual(['Ana']);
  });
});
