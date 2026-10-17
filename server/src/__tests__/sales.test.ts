/**
 * Tests del repo de ventas. Se usa una BD `:memory:` por test para que
 * cada `describe` arranque con un esquema limpio.
 *
 * Patrón (skill zod: `type-input-vs-output` + `parse-validate-early`):
 *  - El input del repo es el OUTPUT type de CreateSaleInput (defaults aplicados
 *    y marcas aplicadas). El repo NO re-valida: confía en que la ruta ya lo hizo.
 *  - En los tests usamos `CreateSaleInput.parse({...})` para construir el input
 *    a partir de un objeto parcial (Zod aplica defaults + marca).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import type { CreateSaleInput, UpdateSaleInput } from '../schemas/sales.js';
import {
  CreateSaleInput as CreateSaleInputSchema,
  UpdateSaleInput as UpdateSaleInputSchema,
} from '../schemas/sales.js';
import { createSalesRepo, type SalesRepo } from '../repo/sales-repo.js';

/** Fija una fecha ISO canónica para tests que dependen del reloj. */
const FIXED_SOLD_AT = '2026-01-15T10:30:00.000Z';
const FIXED_PURCHASE_DATE = '2026-01-05';

/** Helpers: parsean input parcial aplicando defaults y marcas (skill zod: `refine-defaults`). */
const validCreate = (overrides: Record<string, unknown> = {}): CreateSaleInput =>
  CreateSaleInputSchema.parse({ product_name: 'X', ...overrides });

const validUpdate = (overrides: Record<string, unknown> = {}): UpdateSaleInput =>
  UpdateSaleInputSchema.parse(overrides);

describe('sales repo (BD en memoria)', () => {
  let db: Database;
  let repo: SalesRepo;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createSalesRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('crea una venta con todos los campos', () => {
      const sale = repo.create(
        validCreate({
          product_name: 'iPhone 12 64GB',
          buyer_name: 'Juan',
          cost_cents: 15000,
          price_cents: 25000,
          associated_costs_cents: 500,
          sold: true,
          sold_at: FIXED_SOLD_AT,
          purchase_date: FIXED_PURCHASE_DATE,
          notes: 'En caja original',
        }),
      );

      expect(sale.id).toBeGreaterThan(0);
      expect(sale.product_name).toBe('iPhone 12 64GB');
      expect(sale.buyer_name).toBe('Juan');
      expect(sale.cost_cents).toBe(15000);
      expect(sale.price_cents).toBe(25000);
      expect(sale.associated_costs_cents).toBe(500);
      expect(sale.sold).toBe(true);
      expect(sale.sold_at).toBe(FIXED_SOLD_AT);
      expect(sale.purchase_date).toBe(FIXED_PURCHASE_DATE);
      expect(sale.notes).toBe('En caja original');
      expect(sale.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('crea con defaults del schema (solo product_name)', () => {
      const sale = repo.create(validCreate({ product_name: 'Libro' }));

      expect(sale.buyer_name).toBeNull();
      expect(sale.cost_cents).toBe(0);
      expect(sale.price_cents).toBe(0);
      expect(sale.associated_costs_cents).toBe(0);
      expect(sale.sold).toBe(false);
      expect(sale.sold_at).toBeNull();
      expect(sale.purchase_date).toBeNull();
      expect(sale.notes).toBeNull();
    });

    it('respeta sold_at explícito incluso si difiere de now()', () => {
      const sale = repo.create(
        validCreate({
          product_name: 'Pasado',
          sold: true,
          sold_at: '2020-03-15T12:00:00.000Z',
        }),
      );
      expect(sale.sold_at).toBe('2020-03-15T12:00:00.000Z');
    });
  });

  describe('getById', () => {
    it('devuelve null para id inexistente', () => {
      expect(repo.getById(99999)).toBeNull();
    });

    it('devuelve la venta correcta (incluye purchase_date)', () => {
      const created = repo.create(
        validCreate({ product_name: 'X', purchase_date: FIXED_PURCHASE_DATE }),
      );
      const found = repo.getById(created.id);
      expect(found).toEqual(created);
      expect(found!.purchase_date).toBe(FIXED_PURCHASE_DATE);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      repo.create(validCreate({ product_name: 'A', sold: true, sold_at: FIXED_SOLD_AT }));
      repo.create(validCreate({ product_name: 'B', sold: false }));
      repo.create(validCreate({ product_name: 'C', sold: true, sold_at: FIXED_SOLD_AT }));
      repo.create(validCreate({ product_name: 'D', sold: false }));
    });

    it('lista todas por defecto', () => {
      expect(repo.list()).toHaveLength(4);
    });

    it('filtra por sold=true', () => {
      const sold = repo.list({ sold: true });
      expect(sold).toHaveLength(2);
      expect(sold.every((s) => s.sold)).toBe(true);
    });

    it('filtra por sold=false', () => {
      const pending = repo.list({ sold: false });
      expect(pending).toHaveLength(2);
      expect(pending.every((s) => !s.sold)).toBe(true);
    });

    it('respeta limit y offset', () => {
      const first2 = repo.list({ limit: 2, offset: 0 });
      expect(first2).toHaveLength(2);
      const next2 = repo.list({ limit: 2, offset: 2 });
      expect(next2).toHaveLength(2);
      const ids = new Set([...first2, ...next2].map((s) => s.id));
      expect(ids.size).toBe(4);
    });

    it('cappea el limit al máximo permitido (200)', () => {
      expect(repo.list({ limit: 9999 })).toHaveLength(4);
    });
  });

  describe('update', () => {
    it('devuelve null si la venta no existe', () => {
      expect(repo.update(99999, validUpdate({ product_name: 'X' }))).toBeNull();
    });

    it('actualiza campos puntuales', () => {
      const created = repo.create(validCreate({ product_name: 'X', cost_cents: 100 }));
      const updated = repo.update(created.id, validUpdate({ buyer_name: 'Ana', price_cents: 200 }));

      expect(updated).not.toBeNull();
      expect(updated!.buyer_name).toBe('Ana');
      expect(updated!.price_cents).toBe(200);
      expect(updated!.cost_cents).toBe(100);
    });

    it('NO pisa id ni created_at', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      const updated = repo.update(created.id, validUpdate({ product_name: 'Y' }));
      expect(updated!.id).toBe(created.id);
      expect(updated!.created_at).toBe(created.created_at);
    });

    it('flip 0→1 con sold_at explícito respeta el valor del cliente', () => {
      const created = repo.create(validCreate({ product_name: 'X', sold: false }));
      expect(created.sold_at).toBeNull();

      const updated = repo.update(
        created.id,
        validUpdate({ sold: true, sold_at: FIXED_SOLD_AT }),
      );
      expect(updated!.sold).toBe(true);
      expect(updated!.sold_at).toBe(FIXED_SOLD_AT);
    });

    it('flip 1→0 con sold_at: null pisa a null', () => {
      const created = repo.create(
        validCreate({ product_name: 'X', sold: true, sold_at: FIXED_SOLD_AT }),
      );
      expect(created.sold_at).toBe(FIXED_SOLD_AT);

      const updated = repo.update(
        created.id,
        validUpdate({ sold: false, sold_at: null }),
      );
      expect(updated!.sold).toBe(false);
      expect(updated!.sold_at).toBeNull();
    });

    it('update sin tocar sold_at conserva el existente (S2)', () => {
      const created = repo.create(
        validCreate({ product_name: 'X', sold: true, sold_at: FIXED_SOLD_AT }),
      );
      const updated = repo.update(created.id, validUpdate({ product_name: 'Y', sold: true }));
      expect(updated!.sold_at).toBe(FIXED_SOLD_AT);
    });

    it('update cambiando solo sold_at lo pisa al valor del cliente', () => {
      const created = repo.create(
        validCreate({ product_name: 'X', sold: true, sold_at: FIXED_SOLD_AT }),
      );
      const nueva = '2026-06-01T08:00:00.000Z';
      const updated = repo.update(created.id, validUpdate({ sold_at: nueva }));
      expect(updated!.sold_at).toBe(nueva);
      expect(updated!.sold).toBe(true);
    });

    it('input vacío es válido (no cambia nada)', () => {
      const created = repo.create(validCreate({ product_name: 'X', cost_cents: 100 }));
      const updated = repo.update(created.id, {});
      expect(updated).not.toBeNull();
      expect(updated!.product_name).toBe('X');
      expect(updated!.cost_cents).toBe(100);
      expect(updated!.id).toBe(created.id);
      expect(updated!.created_at).toBe(created.created_at);
    });

    it('update de purchase_date lo persiste', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      expect(created.purchase_date).toBeNull();

      const updated = repo.update(created.id, validUpdate({ purchase_date: FIXED_PURCHASE_DATE }));
      expect(updated!.purchase_date).toBe(FIXED_PURCHASE_DATE);
    });

    it('update de purchase_date: null lo borra', () => {
      const created = repo.create(
        validCreate({ product_name: 'X', purchase_date: FIXED_PURCHASE_DATE }),
      );
      expect(created.purchase_date).toBe(FIXED_PURCHASE_DATE);

      const updated = repo.update(created.id, validUpdate({ purchase_date: null }));
      expect(updated!.purchase_date).toBeNull();
    });
  });

  describe('remove', () => {
    it('devuelve true y elimina si existe', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      expect(repo.remove(created.id)).toBe(true);
      expect(repo.getById(created.id)).toBeNull();
    });

    it('devuelve false si no existe', () => {
      expect(repo.remove(99999)).toBe(false);
    });
  });

  describe('stats', () => {
    it('devuelve ceros con BD vacía', () => {
      expect(repo.stats()).toEqual({
        total: 0,
        sold: 0,
        not_sold: 0,
        revenue_cents: 0,
        cost_cents: 0,
        associated_costs_cents: 0,
        net_profit_cents: 0,
      });
    });

    it('calcula revenue solo sobre ventas vendidas', () => {
      repo.create(validCreate({ product_name: 'A', cost_cents: 100, price_cents: 500, sold: true, sold_at: FIXED_SOLD_AT }));
      repo.create(validCreate({ product_name: 'B', cost_cents: 200, price_cents: 800, sold: true, sold_at: FIXED_SOLD_AT }));
      repo.create(validCreate({ product_name: 'C', cost_cents: 50, price_cents: 9999, sold: false }));
      repo.create(validCreate({ product_name: 'D', cost_cents: 30, associated_costs_cents: 20, sold: true, sold_at: FIXED_SOLD_AT }));

      const s = repo.stats();
      expect(s.total).toBe(4);
      expect(s.sold).toBe(3);
      expect(s.not_sold).toBe(1);
      // Revenue: 500 + 800 + 0 (D tiene price 0) = 1300
      expect(s.revenue_cents).toBe(1300);
      // Cost: 100 + 200 + 50 + 30 = 380
      expect(s.cost_cents).toBe(380);
      // Associated: 0 + 0 + 0 + 20 = 20
      expect(s.associated_costs_cents).toBe(20);
      // Net: 1300 - 380 - 20 = 900
      expect(s.net_profit_cents).toBe(900);
    });
  });
});

describe('schemas sales (refinamientos Zod S3)', () => {
  it('create con sold=true sin sold_at → rechaza', () => {
    const r = CreateSaleInputSchema.safeParse({ product_name: 'X', sold: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('sold_at'))).toBe(true);
    }
  });

  it('create con sold=false con sold_at poblado → rechaza', () => {
    const r = CreateSaleInputSchema.safeParse({
      product_name: 'X',
      sold: false,
      sold_at: '2026-01-15T10:00:00.000Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('sold_at'))).toBe(true);
    }
  });

  it('create con sold=true y sold_at → ok', () => {
    const r = CreateSaleInputSchema.safeParse({
      product_name: 'X',
      sold: true,
      sold_at: '2026-01-15T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('create con sold=false y sold_at=null explícito → ok', () => {
    const r = CreateSaleInputSchema.safeParse({
      product_name: 'X',
      sold: false,
      sold_at: null,
    });
    expect(r.success).toBe(true);
  });

  it('update con solo sold=true sin sold_at → PASA (refine sale temprano si falta uno)', () => {
    // Decisión de diseño (S3): el refinamiento de update solo valida la
    // coherencia entre `sold` y `sold_at` cuando el cliente envía AMBOS.
    // Ausencia = "no cambiar este campo". Si el cliente flippea `sold` sin
    // tocar `sold_at`, el server combina con el estado existente.
    // La invariante global la mantiene el caller (el form siempre manda los dos).
    const r = UpdateSaleInputSchema.safeParse({ sold: true });
    expect(r.success).toBe(true);
  });

  it('update con sold=false y sold_at poblado → rechaza', () => {
    const r = UpdateSaleInputSchema.safeParse({
      sold: false,
      sold_at: '2026-01-15T10:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('update con sold=true y sold_at explícito → ok', () => {
    const r = UpdateSaleInputSchema.safeParse({
      sold: true,
      sold_at: '2026-01-15T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('update con solo sold_at (sin tocar sold) → ok (no valida)', () => {
    const r = UpdateSaleInputSchema.safeParse({ sold_at: '2026-01-15T10:00:00.000Z' });
    expect(r.success).toBe(true);
  });

  it('update con solo sold (sin tocar sold_at) → ok (no valida)', () => {
    const r = UpdateSaleInputSchema.safeParse({ sold: false });
    expect(r.success).toBe(true);
  });

  it('purchase_date con formato inválido → rechaza', () => {
    const r = CreateSaleInputSchema.safeParse({
      product_name: 'X',
      purchase_date: '15-01-2026', // formato dd-MM-yyyy no soportado
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('purchase_date'))).toBe(true);
    }
  });

  it('purchase_date con YYYY-MM-DD válido → ok', () => {
    const r = CreateSaleInputSchema.safeParse({
      product_name: 'X',
      purchase_date: '2026-01-15',
    });
    expect(r.success).toBe(true);
  });

  it('update con purchase_date: null → ok (cliente puede borrar)', () => {
    const r = UpdateSaleInputSchema.safeParse({ purchase_date: null });
    expect(r.success).toBe(true);
  });
});

describe('openDb (filesystem path)', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'salemanteiner-dbtest-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('crea el directorio padre si no existe', () => {
    const dbDir = join(tmpRoot, 'no-existe', 'todavia');
    expect(existsSync(dbDir)).toBe(false);

    const dbPath = join(dbDir, 'data.db');
    const db = openDb(dbPath);

    try {
      expect(existsSync(dbDir)).toBe(true);
      // La BD debe ser usable: una tabla cualquiera responde a un SELECT.
      const rows = db.prepare("SELECT 1 AS one").all() as Array<{ one: number }>;
      expect(rows[0]?.one).toBe(1);
    } finally {
      db.close();
    }
  });

  it('es idempotente si el directorio ya existe', () => {
    const dbDir = join(tmpRoot, 'existente');
    mkdirSync(dbDir, { recursive: true });
    expect(existsSync(dbDir)).toBe(true);

    const dbPath = join(dbDir, 'data.db');
    // No debe tirar aunque el dir ya esté.
    const db = openDb(dbPath);
    try {
      const rows = db.prepare("SELECT 1 AS one").all() as Array<{ one: number }>;
      expect(rows[0]?.one).toBe(1);
    } finally {
      db.close();
    }
  });

  it('soporta :memory: sin tocar el filesystem', () => {
    // dirname(':memory:') === '.', mkdirSync('.', { recursive: true }) es no-op,
    // y better-sqlite3 reconoce ':memory:' como BD en memoria. Solo verificamos
    // que sigue andando.
    const db = openDb(':memory:');
    try {
      const rows = db.prepare("SELECT 42 AS v").all() as Array<{ v: number }>;
      expect(rows[0]?.v).toBe(42);
    } finally {
      db.close();
    }
  });
});
