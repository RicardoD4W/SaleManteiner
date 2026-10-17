/**
 * Tests del feature de importación CSV (Fase 3).
 *
 * Cubre:
 *  - `createMany` del repo: inserción atómica, mismo created_at en el batch.
 *  - `ImportSalesInput` (Zod): min(1), max(1000), .strict(), refine S3 anidado.
 *
 * No testeamos el router HTTP directamente: el patrón del proyecto testea repo
 * + Zod, y el endpoint HTTP trivial (4 líneas) queda cubierto por los E2E del front
 * (ver `web/e2e/import-flow.spec.ts`, Feature Fase 3 WU3).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createSalesRepo, type SalesRepo } from '../repo/sales-repo.js';
import { ImportSalesInput } from '../schemas/sales-import.js';
import type { CreateSaleInput } from '../schemas/sales.js';

describe('createMany (repo CSV import)', () => {
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

  function validInput(overrides: Partial<CreateSaleInput> = {}): CreateSaleInput {
    return {
      product_name: 'iPhone 12',
      buyer_name: undefined,
      cost_cents: 15000,
      price_cents: 25000,
      associated_costs_cents: 0,
      sold: false,
      notes: undefined,
      ...overrides,
    } as CreateSaleInput;
  }

  it('inserta N filas válidas en una sola transacción', () => {
    const sales = repo.createMany([
      validInput({ product_name: 'A' }),
      validInput({ product_name: 'B' }),
      validInput({ product_name: 'C' }),
    ]);
    expect(sales).toHaveLength(3);
    expect(repo.list()).toHaveLength(3);
    // El orden de inserción se respeta (A=1, B=2, C=3); list ordena por id DESC.
    const listed = repo.list();
    expect(listed.map((s) => s.product_name)).toEqual(['C', 'B', 'A']);
  });

  it('todas las filas del batch comparten el mismo created_at', () => {
    const sales = repo.createMany([
      validInput({ product_name: 'A' }),
      validInput({ product_name: 'B' }),
      validInput({ product_name: 'C' }),
    ]);
    const timestamps = new Set(sales.map((s) => s.created_at));
    expect(timestamps.size).toBe(1);
  });

  it('acepta exactamente 1000 filas (límite superior de Zod.max)', () => {
    const big = Array.from({ length: 1000 }, (_, i) =>
      validInput({ product_name: `Item ${i}` }),
    );
    const sales = repo.createMany(big);
    expect(sales).toHaveLength(1000);
    expect(repo.stats().total).toBe(1000);
  });

  it('devuelve [] cuando el array está vacío (caller ya validó min(1) en Zod)', () => {
    expect(repo.createMany([])).toEqual([]);
  });

  it('preserva purchase_date y sold_at cuando vienen en las filas', () => {
    const sales = repo.createMany([
      validInput({
        product_name: 'A',
        purchase_date: '2026-01-05',
        sold: true,
        sold_at: '2026-01-10T10:00:00.000Z',
      }),
      validInput({ product_name: 'B' }),
    ]);
    expect(sales[0]!.purchase_date).toBe('2026-01-05');
    expect(sales[0]!.sold_at).toBe('2026-01-10T10:00:00.000Z');
    expect(sales[1]!.purchase_date).toBeNull();
    expect(sales[1]!.sold_at).toBeNull();
  });
});

describe('ImportSalesInput (Zod)', () => {
  it('rechaza sales vacío (min 1 fila)', () => {
    const r = ImportSalesInput.safeParse({ sales: [] });
    expect(r.success).toBe(false);
  });

  it('rechaza más de 1000 filas', () => {
    const arr = Array.from({ length: 1001 }, () => ({ product_name: 'X' }));
    const r = ImportSalesInput.safeParse({ sales: arr });
    expect(r.success).toBe(false);
  });

  it('rechaza fila con sold=true sin sold_at (refine S3 anidado)', () => {
    const r = ImportSalesInput.safeParse({
      sales: [{ product_name: 'X', sold: true }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // El path del issue es ['sales', 0, 'sold_at'] → joined: 'sales.0.sold_at'.
      const hasNestedSoldAt = r.error.issues.some(
        (i) => i.path.join('.') === 'sales.0.sold_at',
      );
      expect(hasNestedSoldAt).toBe(true);
    }
  });

  it('rechaza claves extra a nivel raíz (.strict())', () => {
    const r = ImportSalesInput.safeParse({
      sales: [{ product_name: 'X' }],
      inventado: 'boom',
    });
    expect(r.success).toBe(false);
  });

  it('acepta un set válido mixto (con y sin sold)', () => {
    const r = ImportSalesInput.safeParse({
      sales: [
        { product_name: 'A', cost_cents: 100, price_cents: 200 },
        {
          product_name: 'B',
          cost_cents: 100,
          price_cents: 200,
          sold: true,
          sold_at: '2026-01-01T10:00:00.000Z',
        },
        {
          product_name: 'C',
          cost_cents: 100,
          price_cents: 200,
          purchase_date: '2025-12-01',
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sales).toHaveLength(3);
    }
  });

  it('reporta issues de TODAS las filas inválidas (no solo la primera)', () => {
    const r = ImportSalesInput.safeParse({
      sales: [
        { product_name: 'A', sold: true /* falta sold_at */ },
        { product_name: 'B', cost_cents: -50 /* negativo */ },
        { product_name: 'OK', cost_cents: 100, price_cents: 200 },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // Al menos dos issues distintos.
      const paths = new Set(r.error.issues.map((i) => i.path[1] as number));
      expect(paths.size).toBeGreaterThanOrEqual(2);
    }
  });
});
