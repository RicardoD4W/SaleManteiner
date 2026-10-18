/**
 * Tests del repo de solds (CRUD + detalle con items).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';
import { CreateBuyInput } from '../schemas/buys.js';
import { CreateCustomerInput } from '../schemas/customers.js';

const CreateSoldSchema = CreateSoldInput;
const UpdateSoldSchema = UpdateSoldInput;
const CreateBuySchema = CreateBuyInput;
const CreateCustomerSchema = CreateCustomerInput;

function makeBuy(repo: ReturnType<typeof createBuysRepo>, overrides: Record<string, unknown> = {}) {
  return repo.create(CreateBuySchema.parse({ product_name: 'X', ...overrides }));
}

function makeCustomer(repo: ReturnType<typeof createCustomersRepo>, name = 'Test') {
  return repo.create(CreateCustomerSchema.parse({ name }));
}

function validSold(
  customerId: number,
  buyId: number,
  overrides: Record<string, unknown> = {},
) {
  return CreateSoldSchema.parse({
    customer_id: customerId,
    sale_price: 0,
    items: [{ buy_id: buyId, quantity: 1 }],
    ...overrides,
  });
}

function validUpdate(overrides: Record<string, unknown> = {}) {
  return UpdateSoldSchema.parse(overrides);
}

describe('solds repo', () => {
  let db: Database;
  let buysRepo: ReturnType<typeof createBuysRepo>;
  let soldsRepo: ReturnType<typeof createSoldsRepo>;
  let customersRepo: ReturnType<typeof createCustomersRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    buysRepo = createBuysRepo(db);
    soldsRepo = createSoldsRepo(db);
    customersRepo = createCustomersRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createManyWithStockCheck', () => {
    it('crea una venta simple con un item', () => {
      const customer = makeCustomer(customersRepo, 'Juan');
      const buy = makeBuy(buysRepo, { product_name: 'Funda', purchase_cost: 10, quantity: 5 });

      const sold = soldsRepo.createManyWithStockCheck(
        validSold(customer.id, buy.id, { sale_price: 20, items: [{ buy_id: buy.id, quantity: 2 }] }),
      );

      expect(sold.id).toBeGreaterThan(0);
      expect(sold.customer_id).toBe(customer.id);
      expect(sold.sale_price).toBe(20);
      expect(sold.sold_at).toBeNull();
    });

    it('crea una venta con sold_at', () => {
      const customer = makeCustomer(customersRepo);
      const buy = makeBuy(buysRepo);

      const sold = soldsRepo.createManyWithStockCheck(
        validSold(customer.id, buy.id, {
          sale_price: 50,
          sold_at: '2026-01-15',
          items: [{ buy_id: buy.id, quantity: 1 }],
        }),
      );
      expect(sold.sold_at).toBe('2026-01-15');
    });

    it('redondea sale_price y associated_costs a 2 decimales', () => {
      const customer = makeCustomer(customersRepo);
      const buy = makeBuy(buysRepo);

      const sold = soldsRepo.createManyWithStockCheck(
        validSold(customer.id, buy.id, {
          sale_price: 33.34,
          associated_costs: 0.07,
          items: [{ buy_id: buy.id, quantity: 1 }],
        }),
      );
      expect(sold.sale_price).toBe(33.34);
      expect(sold.associated_costs).toBe(0.07);
    });
  });

  describe('getById', () => {
    it('devuelve null para id inexistente', () => {
      expect(soldsRepo.getById(99999)).toBeNull();
    });

    it('devuelve la venta correcta', () => {
      const customer = makeCustomer(customersRepo);
      const buy = makeBuy(buysRepo);
      const created = soldsRepo.createManyWithStockCheck(
        validSold(customer.id, buy.id, { sale_price: 100, items: [{ buy_id: buy.id, quantity: 1 }] }),
      );
      const found = soldsRepo.getById(created.id);
      expect(found).toEqual(created);
    });
  });

  describe('getByIdWithItems', () => {
    it('devuelve null para id inexistente', () => {
      expect(soldsRepo.getByIdWithItems(99999)).toBeNull();
    });

    it('devuelve venta con items y nombre del cliente', () => {
      const customer = makeCustomer(customersRepo, 'Pedro');
      const buy = makeBuy(buysRepo, { product_name: 'Funda', purchase_cost: 50, quantity: 5 });

      const created = soldsRepo.createManyWithStockCheck(
        validSold(customer.id, buy.id, {
          sale_price: 100,
          items: [{ buy_id: buy.id, quantity: 3 }],
        }),
      );

      const found = soldsRepo.getByIdWithItems(created.id);
      expect(found).not.toBeNull();
      expect(found!.customer_name).toBe('Pedro');
      expect(found!.items).toHaveLength(1);
      expect(found!.items[0]).toMatchObject({
        buy_id: buy.id,
        product_name: 'Funda',
        quantity: 3,
        unit_cost: 10, // 50 / 5 = 10
        unit_assoc: 0,
      });
    });
  });

  describe('list', () => {
    it('lista todas', () => {
      const c = makeCustomer(customersRepo);
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);
      soldsRepo.createManyWithStockCheck(validSold(c.id, b1.id, { items: [{ buy_id: b1.id, quantity: 1 }] }));
      soldsRepo.createManyWithStockCheck(validSold(c.id, b2.id, { items: [{ buy_id: b2.id, quantity: 1 }] }));
      expect(soldsRepo.list()).toHaveLength(2);
    });

    it('filtra por customerId', () => {
      const c1 = makeCustomer(customersRepo, 'Ana');
      const c2 = makeCustomer(customersRepo, 'Luis');
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);
      const b3 = makeBuy(buysRepo);

      soldsRepo.createManyWithStockCheck(validSold(c1.id, b1.id, { items: [{ buy_id: b1.id, quantity: 1 }] }));
      soldsRepo.createManyWithStockCheck(validSold(c1.id, b2.id, { items: [{ buy_id: b2.id, quantity: 1 }] }));
      soldsRepo.createManyWithStockCheck(validSold(c2.id, b3.id, { items: [{ buy_id: b3.id, quantity: 1 }] }));

      expect(soldsRepo.list({ customerId: c1.id })).toHaveLength(2);
      expect(soldsRepo.list({ customerId: c2.id })).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('devuelve null si no existe', () => {
      expect(soldsRepo.update(99999, validUpdate({ sale_price: 100 }))).toBeNull();
    });

    it('actualiza campos', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo);
      const created = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, { sale_price: 10, items: [{ buy_id: b.id, quantity: 1 }] }),
      );
      const updated = soldsRepo.update(created.id, validUpdate({ sale_price: 200, associated_costs: 5 }));
      expect(updated!.sale_price).toBe(200);
      expect(updated!.associated_costs).toBe(5);
    });

    it('NO pisa id ni created_at', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo);
      const created = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, { items: [{ buy_id: b.id, quantity: 1 }] }),
      );
      const updated = soldsRepo.update(created.id, validUpdate({ sale_price: 100 }));
      expect(updated!.id).toBe(created.id);
      expect(updated!.created_at).toBe(created.created_at);
    });

    it('input vacío no cambia nada', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo);
      const created = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, { sale_price: 50, items: [{ buy_id: b.id, quantity: 1 }] }),
      );
      const updated = soldsRepo.update(created.id, {});
      expect(updated!.sale_price).toBe(50);
    });
  });

  describe('remove', () => {
    it('devuelve true y elimina si existe', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo);
      const created = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, { items: [{ buy_id: b.id, quantity: 1 }] }),
      );
      expect(soldsRepo.remove(created.id)).toBe(true);
      expect(soldsRepo.getById(created.id)).toBeNull();
    });

    it('devuelve false si no existe', () => {
      expect(soldsRepo.remove(99999)).toBe(false);
    });
  });
});

describe('schemas solds (Zod)', () => {
  it('create sin items → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it('create con item sin buy_id → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      items: [{ quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('create con item quantity 0 → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      items: [{ buy_id: 1, quantity: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it('create sin customer_id → rechaza', () => {
    const r = CreateSoldSchema.safeParse({ sale_price: 10, items: [{ buy_id: 1, quantity: 1 }] });
    expect(r.success).toBe(false);
  });

  it('create con campos extra → rechaza (.strict())', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      items: [{ buy_id: 1, quantity: 1 }],
      unknown: 'no',
    });
    expect(r.success).toBe(false);
  });

  it('create con sale_price negativo → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: -5,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('create con associated_costs negativo → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      associated_costs: -1,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('create sin sale_price → ok (default 0)', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sale_price).toBe(0);
  });

  it('sold_at con formato YYYY-MM-DD válido → ok', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      sold_at: '2026-01-15',
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(true);
  });

  it('sold_at con formato inválido → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 10,
      sold_at: '15-01-2026',
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('update sin campos → ok', () => {
    const r = UpdateSoldSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('update con sale_price negativo → rechaza', () => {
    const r = UpdateSoldSchema.safeParse({ sale_price: -10 });
    expect(r.success).toBe(false);
  });
});
