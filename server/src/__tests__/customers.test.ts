import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
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
  let buysRepo: ReturnType<typeof createBuysRepo>;
  let soldsRepo: ReturnType<typeof createSoldsRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createCustomersRepo(db);
    buysRepo = createBuysRepo(db);
    soldsRepo = createSoldsRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedBuy(quantity = 5) {
    return buysRepo.create({
      product_name: 'Producto',
      purchase_cost: 50,
      quantity,
      associated_costs: 0,
    });
  }

  function seedSale(customer_id: number, quantity = 1, sold_at = '2026-10-20') {
    const buy = seedBuy(quantity + 1);
    return soldsRepo.createManyWithStockCheck({
      customer_id,
      sale_price: 100,
      associated_costs: 0,
      sold_at,
      items: [{ buy_id: buy.id, quantity }],
    });
  }

  function count(sql: string, ...args: unknown[]): number {
    return (db.prepare(sql).get(...args) as { c: number }).c;
  }

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
      for (let i = 0; i < 25; i++) {
        repo.create(validCreate({ name: `Cliente ${i}` }));
      }
      const results = repo.search('');
      expect(results).toHaveLength(20);
    });

    it('trata el % como un carácter literal y no como comodín', () => {
      repo.create(validCreate({ name: '50% de descuento' }));
      repo.create(validCreate({ name: 'Precio normal' }));

      const results = repo.search('50%');

      expect(results.map((c) => c.name)).toEqual(['50% de descuento']);
    });

    it('trata el _ como un carácter literal y no como comodín', () => {
      repo.create(validCreate({ name: 'Camisa_Manga' }));
      repo.create(validCreate({ name: 'CamisaLarga' }));

      const results = repo.search('Camisa_');

      expect(results.map((c) => c.name)).toEqual(['Camisa_Manga']);
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

    it('cada cliente trae su numero de ventas y su total gastado', () => {
      const ana = repo.create(validCreate({ name: 'Ana' }));
      const zara = repo.create(validCreate({ name: 'Zara' }));

      seedSale(ana.id, 1, '2026-10-20');
      seedSale(ana.id, 1, '2026-10-21');

      const all = repo.list();
      const anaRow = all.find((c) => c.id === ana.id);
      const zaraRow = all.find((c) => c.id === zara.id);

      expect(anaRow?.ventas).toBe(2);
      expect(anaRow?.total_gastado).toBe(200);
      expect(zaraRow?.ventas).toBe(0);
      expect(zaraRow?.total_gastado).toBe(0);
    });

    it('la busqueda tambien trae las metricas', () => {
      const ana = repo.create(validCreate({ name: 'Ana' }));
      repo.create(validCreate({ name: 'Zara' }));
      seedSale(ana.id, 1, '2026-10-20');

      const results = repo.search('an');

      expect(results).toHaveLength(1);
      expect(results[0]?.ventas).toBe(1);
      expect(results[0]?.total_gastado).toBe(100);
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
    it('cliente sin ventas: devuelve { ok: true } y elimina', () => {
      const created = repo.create(validCreate({ name: 'Ana' }));
      expect(repo.remove(created.id)).toEqual({ ok: true });
      expect(repo.getById(created.id)).toBeNull();
    });

    it('cliente inexistente: devuelve NOT_FOUND', () => {
      expect(repo.remove(99999)).toEqual({ ok: false, code: 'NOT_FOUND' });
    });

    it('cliente con ventas: devuelve HAS_ASSOCIATED_SALES y NO borra nada', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const sale = seedSale(customer.id, 2);

      const result = repo.remove(customer.id);

      expect(result).toEqual({
        ok: false,
        code: 'HAS_ASSOCIATED_SALES',
        sales: [
          {
            id: sale.id,
            customer_name: 'Ana',
            sold_at: '2026-10-20',
            items_count: 2,
          },
        ],
      });
      expect(repo.getById(customer.id)).not.toBeNull();
      expect(soldsRepo.getById(sale.id)).not.toBeNull();
    });

    it('cliente con varias ventas: lista todas las ventas asociadas', () => {
      const customer = repo.create(validCreate({ name: 'Nora' }));
      const sale1 = seedSale(customer.id, 1);
      const sale2 = seedSale(customer.id, 3);

      const result = repo.remove(customer.id);

      expect(result.ok).toBe(false);
      if (result.ok || result.code !== 'HAS_ASSOCIATED_SALES') {
        throw new Error('se esperaba HAS_ASSOCIATED_SALES');
      }
      expect(result.sales).toEqual([
        {
          id: sale2.id,
          customer_name: 'Nora',
          sold_at: '2026-10-20',
          items_count: 3,
        },
        {
          id: sale1.id,
          customer_name: 'Nora',
          sold_at: '2026-10-20',
          items_count: 1,
        },
      ]);
    });

    it('las ventas de OTROS clientes no bloquean el borrado', () => {
      const withSales = repo.create(validCreate({ name: 'Con ventas' }));
      const other = repo.create(validCreate({ name: 'Otro' }));
      const sale = seedSale(withSales.id, 1);

      expect(repo.remove(other.id)).toEqual({ ok: true });
      expect(repo.getById(other.id)).toBeNull();
      expect(soldsRepo.getById(sale.id)).not.toBeNull();
      expect(repo.getById(withSales.id)).not.toBeNull();
    });
  });

  describe('listAssociatedSales', () => {
    it('devuelve [] si el cliente no tiene ventas', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      expect(repo.listAssociatedSales(customer.id)).toEqual([]);
    });

    it('lista las ventas con items_count (unidades) y de la más reciente a la más vieja', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const sale1 = seedSale(customer.id, 2);
      const sale2 = seedSale(customer.id, 1);

      expect(repo.listAssociatedSales(customer.id)).toEqual([
        {
          id: sale2.id,
          customer_name: 'Ana',
          sold_at: '2026-10-20',
          items_count: 1,
        },
        {
          id: sale1.id,
          customer_name: 'Ana',
          sold_at: '2026-10-20',
          items_count: 2,
        },
      ]);
    });
  });

  describe('removeWithCascade', () => {
    it('borra el cliente, sus ventas y sus sale_items', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const sale = seedSale(customer.id, 2);

      expect(repo.removeWithCascade(customer.id).ok).toBe(true);

      expect(repo.getById(customer.id)).toBeNull();
      expect(soldsRepo.getById(sale.id)).toBeNull();
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', sale.id)).toBe(0);
      expect(count('SELECT COUNT(*) AS c FROM solds WHERE customer_id = ?', customer.id)).toBe(0);
    });

    it('no toca las ventas de otros clientes', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const other = repo.create(validCreate({ name: 'Beto' }));
      const mine = seedSale(customer.id, 1);
      const otherSale = seedSale(other.id, 1);

      expect(repo.removeWithCascade(customer.id).ok).toBe(true);

      expect(repo.getById(customer.id)).toBeNull();
      expect(soldsRepo.getById(mine.id)).toBeNull();
      expect(repo.getById(other.id)).not.toBeNull();
      expect(soldsRepo.getById(otherSale.id)).not.toBeNull();
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', otherSale.id)).toBe(1);
    });

    it('devuelve false si el cliente no existe', () => {
      expect(repo.removeWithCascade(99999)).toEqual({ ok: false, code: 'NOT_FOUND' });
    });

    it('es transaccional: si el borrado de las ventas falla, no se borra nada', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const sale = seedSale(customer.id, 1);
      db.exec(
        `CREATE TRIGGER block_sold_delete BEFORE DELETE ON solds
         BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
      );

      expect(() => repo.removeWithCascade(customer.id)).toThrow();

      expect(repo.getById(customer.id)).not.toBeNull();
      expect(soldsRepo.getById(sale.id)).not.toBeNull();
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', sale.id)).toBe(1);
    });

    it('es transaccional también con el borrado del cliente (el último paso)', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const sale = seedSale(customer.id, 1);
      db.exec(
        `CREATE TRIGGER block_customer_delete BEFORE DELETE ON customers
         BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
      );

      expect(() => repo.removeWithCascade(customer.id)).toThrow();

      expect(repo.getById(customer.id)).not.toBeNull();
      expect(soldsRepo.getById(sale.id)).not.toBeNull();
      expect(count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id = ?', sale.id)).toBe(1);
    });

    it('no deja filas huérfanas: ni items sin venta ni ventas sin cliente', () => {
      const customer = repo.create(validCreate({ name: 'Ana' }));
      const other = repo.create(validCreate({ name: 'Beto' }));
      seedSale(customer.id, 2);
      seedSale(other.id, 1);

      expect(repo.removeWithCascade(customer.id).ok).toBe(true);

      expect(
        count('SELECT COUNT(*) AS c FROM sale_items WHERE sold_id NOT IN (SELECT id FROM solds)'),
      ).toBe(0);
      expect(
        count('SELECT COUNT(*) AS c FROM sale_items WHERE buy_id NOT IN (SELECT id FROM buys)'),
      ).toBe(0);
      expect(
        count(
          'SELECT COUNT(*) AS c FROM solds WHERE customer_id NOT IN (SELECT id FROM customers)',
        ),
      ).toBe(0);
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
