/**
 * Tests del repo de buys (CRUD + getWithStock).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

const CreateSchema = CreateBuyInput;
const UpdateSchema = UpdateBuyInput;

function validCreate(overrides: Record<string, unknown> = {}): ReturnType<typeof CreateSchema.parse> {
  return CreateSchema.parse({ product_name: 'X', ...overrides });
}

function validUpdate(overrides: Record<string, unknown> = {}): ReturnType<typeof UpdateSchema.parse> {
  return UpdateSchema.parse(overrides);
}

describe('buys repo', () => {
  let db: Database;
  let repo: ReturnType<typeof createBuysRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createBuysRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('crea una compra con todos los campos', () => {
      const b = repo.create(
        validCreate({
          product_name: 'iPhone 12',
          purchase_cost: 500,
          quantity: 3,
          associated_costs: 20,
          purchase_date: '2026-01-05',
        }),
      );
      expect(b.id).toBeGreaterThan(0);
      expect(b.product_name).toBe('iPhone 12');
      expect(b.purchase_cost).toBe(500);
      expect(b.quantity).toBe(3);
      expect(b.associated_costs).toBe(20);
      expect(b.purchase_date).toBe('2026-01-05');
    });

    it('crea con defaults (solo product_name)', () => {
      const b = repo.create(validCreate({ product_name: 'Libro' }));
      expect(b.purchase_cost).toBe(0);
      expect(b.quantity).toBe(1);
      expect(b.associated_costs).toBe(0);
      expect(b.purchase_date).toBeNull();
    });

    it('redondea purchase_cost y associated_costs a 2 decimales', () => {
      const b = repo.create(
        validCreate({ product_name: 'X', purchase_cost: 33.34, associated_costs: 0.07 }),
      );
      expect(b.purchase_cost).toBe(33.34);
      expect(b.associated_costs).toBe(0.07);
    });
  });

  describe('getById', () => {
    it('devuelve null para id inexistente', () => {
      expect(repo.getById(99999)).toBeNull();
    });

    it('devuelve la compra correcta', () => {
      const created = repo.create(validCreate({ product_name: 'X', purchase_date: '2026-01-05' }));
      const found = repo.getById(created.id);
      expect(found).toEqual(created);
      expect(found!.purchase_date).toBe('2026-01-05');
    });
  });

  describe('list', () => {
    it('lista todas por defecto', () => {
      repo.create(validCreate({ product_name: 'A' }));
      repo.create(validCreate({ product_name: 'B' }));
      expect(repo.list()).toHaveLength(2);
    });

    it('filtra por dateRange', () => {
      repo.create(validCreate({ product_name: 'A', purchase_date: '2026-01-01' }));
      repo.create(validCreate({ product_name: 'B', purchase_date: '2026-06-01' }));
      repo.create(validCreate({ product_name: 'C', purchase_date: '2026-12-01' }));

      const r = repo.list({ dateRange: { from: '2026-01-01', to: '2026-06-30' } });
      expect(r).toHaveLength(2);
      expect(r.map((b) => b.product_name)).toEqual(['B', 'A']);
    });

    it('filtra por from only', () => {
      repo.create(validCreate({ product_name: 'A', purchase_date: '2026-01-01' }));
      repo.create(validCreate({ product_name: 'B', purchase_date: '2026-12-01' }));
      const r = repo.list({ dateRange: { from: '2026-06-01' } });
      expect(r).toHaveLength(1);
      expect(r[0]!.product_name).toBe('B');
    });

    it('el valor del filtro va bindeado: un payload de inyección no ejecuta SQL', () => {
      // El WHERE es fijo y el valor del filtro viaja como parámetro
      // bindeado. Este test deja esa propiedad escrita: si alguien cambia
      // el valor por interpolación, la tabla 'buys' desaparece.
      repo.create(validCreate({ product_name: 'A', purchase_date: '2026-01-01' }));

      const r = repo.list({
        dateRange: { from: "2026-01-01'; DROP TABLE buys; --" },
      });

      expect(r).toHaveLength(0);
      // La tabla sigue en pie: el payload se comparó como texto.
      expect(repo.list()).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('devuelve null si no existe', () => {
      expect(repo.update(99999, validUpdate({ product_name: 'X' }))).toBeNull();
    });

    it('actualiza campos puntuales', () => {
      const created = repo.create(validCreate({ product_name: 'X', purchase_cost: 100 }));
      const updated = repo.update(created.id, validUpdate({ purchase_cost: 200 }));
      expect(updated!.purchase_cost).toBe(200);
      expect(updated!.product_name).toBe('X');
    });

    it('NO pisa id ni created_at', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      const updated = repo.update(created.id, validUpdate({ product_name: 'Y' }));
      expect(updated!.id).toBe(created.id);
      expect(updated!.created_at).toBe(created.created_at);
    });

    it('update de purchase_date lo persiste', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      expect(created.purchase_date).toBeNull();
      const updated = repo.update(created.id, validUpdate({ purchase_date: '2026-01-05' }));
      expect(updated!.purchase_date).toBe('2026-01-05');
    });

    it('update de purchase_date: null lo borra', () => {
      const created = repo.create(validCreate({ product_name: 'X', purchase_date: '2026-01-05' }));
      const updated = repo.update(created.id, validUpdate({ purchase_date: null }));
      expect(updated!.purchase_date).toBeNull();
    });
  });

  describe('remove', () => {
    it('sin ventas asociadas: ok=true y la compra no existe después', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      expect(repo.remove(created.id)).toEqual({ ok: true });
      expect(repo.getById(created.id)).toBeNull();
    });

    it('id inexistente: ok=false con code=NOT_FOUND', () => {
      expect(repo.remove(99999)).toEqual({ ok: false, code: 'NOT_FOUND' });
    });

    it('con una venta asociada: ok=false con code=HAS_ASSOCIATED_SALES y la compra SIGUE existiendo', () => {
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());

      const buy = repo.create(validCreate({ product_name: 'X', quantity: 10 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buy.id,
        2,
      );

      const result = repo.remove(buy.id);
      expect(result).toEqual({
        ok: false,
        code: 'HAS_ASSOCIATED_SALES',
        sales: [{ id: 1, customer_name: 'Test', sold_at: null, items_count: 2 }],
      });
      // La compra NO se borró (rollback implícito).
      expect(repo.getById(buy.id)).not.toBeNull();
    });

    it('con múltiples ventas asociadas: devuelve todas, orden DESC por id, con items_count respectivo', () => {
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(2, 1, 0, 0, new Date().toISOString());

      const buy = repo.create(validCreate({ product_name: 'X', quantity: 10 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buy.id,
        2,
      );
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        2,
        buy.id,
        4,
      );

      const result = repo.remove(buy.id);
      expect(result).toEqual({
        ok: false,
        code: 'HAS_ASSOCIATED_SALES',
        sales: [
          { id: 2, customer_name: 'Test', sold_at: null, items_count: 4 },
          { id: 1, customer_name: 'Test', sold_at: null, items_count: 2 },
        ],
      });
    });

    it('con associated_sales: items_count suma SOLO los items de este buy (no del pack)', () => {
      // Pack: el sold 1 tiene items de buyA (qty 2) y buyB (qty 3).
      // remove(buyA) debe reportar items_count=2 para sold 1, NO 5.
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());

      const buyA = repo.create(validCreate({ product_name: 'A', quantity: 5 }));
      const buyB = repo.create(validCreate({ product_name: 'B', quantity: 5 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buyA.id,
        2,
      );
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buyB.id,
        3,
      );

      const result = repo.remove(buyA.id);
      expect(result).toEqual({
        ok: false,
        code: 'HAS_ASSOCIATED_SALES',
        sales: [{ id: 1, customer_name: 'Test', sold_at: null, items_count: 2 }],
      });
    });
  });

  describe('removeWithCascade', () => {
    it('id inexistente: devuelve false (no rompe)', () => {
      expect(repo.removeWithCascade(99999)).toBe(false);
    });

    it('sin ventas asociadas: borra la compra', () => {
      const created = repo.create(validCreate({ product_name: 'X' }));
      expect(repo.removeWithCascade(created.id)).toBe(true);
      expect(repo.getById(created.id)).toBeNull();
    });

    it('venta single-item: borra la compra Y la venta (no quedan filas)', () => {
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());
      const buy = repo.create(validCreate({ product_name: 'X', quantity: 5 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buy.id,
        1,
      );

      expect(repo.removeWithCascade(buy.id)).toBe(true);

      expect(repo.getById(buy.id)).toBeNull();
      expect(db.prepare('SELECT * FROM solds WHERE id = 1').get()).toBeUndefined();
      expect(db.prepare('SELECT * FROM sale_items').all()).toEqual([]);
    });

    it('venta pack (este buy + otro buy en misma venta): borra la compra, la venta sigue sin este item', () => {
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());
      const buyA = repo.create(validCreate({ product_name: 'A', quantity: 5 }));
      const buyB = repo.create(validCreate({ product_name: 'B', quantity: 5 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buyA.id,
        2,
      );
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buyB.id,
        3,
      );

      expect(repo.removeWithCascade(buyA.id)).toBe(true);

      // buyA borrada
      expect(repo.getById(buyA.id)).toBeNull();
      // buyB sigue existiendo
      expect(repo.getById(buyB.id)).not.toBeNull();
      // Venta sigue existiendo
      expect(db.prepare('SELECT * FROM solds WHERE id = 1').get()).toBeDefined();
      // Solo queda el item de buyB en el pack
      const items = db.prepare('SELECT * FROM sale_items').all() as Array<{
        sold_id: number;
        buy_id: number;
        quantity: number;
      }>;
      expect(items).toEqual([{ sold_id: 1, buy_id: buyB.id, quantity: 3 }]);
    });

    it('venta pack donde este buy era el único item: borra la compra Y la venta', () => {
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(
        1,
        'Test',
        new Date().toISOString(),
      );
      db.prepare(
        'INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(1, 1, 0, 0, new Date().toISOString());
      const buy = repo.create(validCreate({ product_name: 'X', quantity: 5 }));
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(
        1,
        buy.id,
        5,
      );

      expect(repo.removeWithCascade(buy.id)).toBe(true);

      expect(repo.getById(buy.id)).toBeNull();
      expect(db.prepare('SELECT * FROM solds WHERE id = 1').get()).toBeUndefined();
      expect(db.prepare('SELECT * FROM sale_items').all()).toEqual([]);
    });
  });

  describe('getWithStock', () => {
    it('devuelve [] si no hay buys', () => {
      expect(repo.getWithStock()).toEqual([]);
    });

    it('devuelve buy sin ventas con stock = quantity', () => {
      const b = repo.create(validCreate({ product_name: 'A', quantity: 5 }));
      const result = repo.getWithStock();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(b.id);
      expect(result[0]!.disponibles).toBe(5);
    });

    it('devuelve buy parcialmente vendido con stock = quantity - vendidos', () => {
      // Insertar un customer + sold para poder insertar en sale_items (FK constraint)
      db.prepare('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)').run(1, 'Test', new Date().toISOString());
      db.prepare('INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)').run(1, 1, 0, 0, new Date().toISOString());
      db.prepare('INSERT INTO solds (id, customer_id, sale_price, associated_costs, created_at) VALUES (?, ?, ?, ?, ?)').run(2, 1, 0, 0, new Date().toISOString());

      const b = repo.create(validCreate({ product_name: 'X', quantity: 10 }));
      // Simular que hay 3 vendidos en sale_items (con FK a solds)
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(1, b.id, 3);
      db.prepare('INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)').run(2, b.id, 4);
      const result = repo.getWithStock();
      expect(result).toHaveLength(1);
      expect(result[0]!.disponibles).toBe(3); // 10 - 3 - 4 = 3
    });
  });
});

describe('schemas buys (Zod)', () => {
  it('create con purchase_cost = 0.001 → rechaza (multipleOf 0.01)', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', purchase_cost: 0.001 });
    expect(r.success).toBe(false);
  });

  it('create con purchase_cost = 0.01 → ok', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', purchase_cost: 0.01 });
    expect(r.success).toBe(true);
  });

  it('create con purchase_cost negativo → rechaza', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', purchase_cost: -5 });
    expect(r.success).toBe(false);
  });

  it('create con quantity = 0 → rechaza', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', quantity: 0 });
    expect(r.success).toBe(false);
  });

  it('create con quantity negativo → rechaza', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', quantity: -1 });
    expect(r.success).toBe(false);
  });

  it('create sin campos opcionales → ok (defaults)', () => {
    const r = CreateSchema.safeParse({ product_name: 'Test' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.purchase_cost).toBe(0);
      expect(r.data.quantity).toBe(1);
      expect(r.data.associated_costs).toBe(0);
    }
  });

  it('create con campos extra → rechaza (.strict())', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', unknown_field: 'no' });
    expect(r.success).toBe(false);
  });

  it('update sin campos → ok', () => {
    const r = UpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('update con purchase_cost negativo → rechaza', () => {
    const r = UpdateSchema.safeParse({ purchase_cost: -10 });
    expect(r.success).toBe(false);
  });

  it('purchase_date con formato inválido → rechaza', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', purchase_date: '15-01-2026' });
    expect(r.success).toBe(false);
  });

  it('purchase_date con YYYY-MM-DD válido → ok', () => {
    const r = CreateSchema.safeParse({ product_name: 'X', purchase_date: '2026-01-15' });
    expect(r.success).toBe(true);
  });
});
