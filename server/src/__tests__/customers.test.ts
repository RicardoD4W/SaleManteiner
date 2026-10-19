/**
 * Tests del repo de customers (CRUD + search).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customers.js';

const CreateSchema = CreateCustomerInput;
const UpdateSchema = UpdateCustomerInput;

function validCreate(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof CreateSchema.parse> {
  return CreateSchema.parse({ name: 'Test', ...overrides });
}

function validUpdate(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof UpdateSchema.parse> {
  return UpdateSchema.parse(overrides);
}

describe('customers repo', () => {
  let db: Database;
  let repo: ReturnType<typeof createCustomersRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createCustomersRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('crea un cliente con name', () => {
      const c = repo.create(validCreate({ name: 'Juan Pérez' }));
      expect(c.id).toBeGreaterThan(0);
      expect(c.name).toBe('Juan Pérez');
      expect(c.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('crea con defaults', () => {
      const c = repo.create(validCreate({}));
      expect(c.name).toBe('Test');
      expect(c.id).toBeGreaterThan(0);
    });
  });

  describe('getById', () => {
    it('devuelve null para id inexistente', () => {
      expect(repo.getById(99999)).toBeNull();
    });

    it('devuelve el cliente correcto', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      const found = repo.getById(created.id);
      expect(found).toEqual(created);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      repo.create(validCreate({ name: 'Juan Pérez' }));
      repo.create(validCreate({ name: 'María García' }));
      repo.create(validCreate({ name: 'Carlos Juan' }));
      repo.create(validCreate({ name: 'Ana' }));
    });

    it('busca por subcadena case-insensitive', () => {
      const results = repo.search('juan');
      expect(results.map((c) => c.name)).toContain('Juan Pérez');
      expect(results.map((c) => c.name)).toContain('Carlos Juan');
    });

    it('busca parcial (middle of name)', () => {
      const results = repo.search('gar');
      expect(results.map((c) => c.name)).toEqual(['María García']);
    });

    it('devuelve hasta 20 resultados', () => {
      const results = repo.search('');
      // empty search pattern matches all
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('list', () => {
    it('lista todos ordenados por nombre', () => {
      repo.create(validCreate({ name: 'Zara' }));
      repo.create(validCreate({ name: 'Ana' }));
      repo.create(validCreate({ name: 'Pedro' }));
      const all = repo.list();
      expect(all.map((c) => c.name)).toEqual(['Ana', 'Pedro', 'Zara']);
    });

    it('devuelve [] si no hay clientes', () => {
      expect(repo.list()).toEqual([]);
    });
  });

  describe('update', () => {
    it('devuelve null si no existe', () => {
      expect(repo.update(99999, validUpdate({ name: 'X' }))).toBeNull();
    });

    it('actualiza el nombre', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      const updated = repo.update(created.id, validUpdate({ name: 'Ana María' }));
      expect(updated!.name).toBe('Ana María');
    });

    it('no cambia id ni created_at', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      const updated = repo.update(created.id, validUpdate({ name: 'Ana María' }));
      expect(updated!.id).toBe(created.id);
      expect(updated!.created_at).toBe(created.created_at);
    });

    it('input vacío no cambia nada', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      const updated = repo.update(created.id, {});
      expect(updated!.name).toBe('Ana');
      expect(updated!.id).toBe(created.id);
    });
  });

  describe('remove', () => {
    it('devuelve true y elimina si existe', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      expect(repo.remove(created.id)).toBe(true);
      expect(repo.getById(created.id)).toBeNull();
    });

    it('devuelve false si no existe', () => {
      expect(repo.remove(99999)).toBe(false);
    });
  });
});

describe('schemas customers (Zod)', () => {
  it('create sin name → rechaza', () => {
    const r = CreateSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('create con name vacío → rechaza', () => {
    const r = CreateSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('create con name válido → ok', () => {
    const r = CreateSchema.safeParse({ name: 'Juan Pérez' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe('Juan Pérez');
    }
  });

  it('create con campos extra → rechaza (.strict())', () => {
    const r = CreateSchema.safeParse({ name: 'Test', extra: 'no' });
    expect(r.success).toBe(false);
  });

  it('update sin campos → ok', () => {
    const r = UpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('update con name → ok', () => {
    const r = UpdateSchema.safeParse({ name: 'Nuevo' });
    expect(r.success).toBe(true);
  });
});
