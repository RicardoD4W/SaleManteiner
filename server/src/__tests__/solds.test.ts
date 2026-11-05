import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import type { AddressInfo } from 'node:net';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo, PaidAmountExceedsPriceError } from '../repo/solds-repo.js';
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

function validSold(customerId: number, buyId: number, overrides: Record<string, unknown> = {}) {
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

function rawPaidAmount(db: Database, soldId: number): number {
  const row = db.prepare('SELECT paid_amount FROM solds WHERE id = ?').get(soldId) as {
    paid_amount: number;
  };
  return row.paid_amount;
}

function customerDebt(repo: ReturnType<typeof createCustomersRepo>, customerId: number): number {
  const customer = repo.list().find((c) => c.id === customerId);
  return customer?.deuda ?? 0;
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
        validSold(customer.id, buy.id, {
          sale_price: 20,
          items: [{ buy_id: buy.id, quantity: 2 }],
        }),
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
        validSold(customer.id, buy.id, {
          sale_price: 100,
          items: [{ buy_id: buy.id, quantity: 1 }],
        }),
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
        unit_cost: 10,
        unit_assoc: 0,
      });
    });
  });

  describe('listWithProfit', () => {
    it('incluye los items vendidos en cada fila (S de UI: mostrar qué se vendió)', () => {
      const c = makeCustomer(customersRepo, 'Pepe');
      const b1 = makeBuy(buysRepo, {
        product_name: 'sobre pokemon',
        purchase_cost: 10,
        quantity: 10,
      });
      const b2 = makeBuy(buysRepo, { product_name: 'carta magic', purchase_cost: 5, quantity: 3 });

      const s1 = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b1.id, { sale_price: 9, items: [{ buy_id: b1.id, quantity: 2 }] }),
      );
      const s2 = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b2.id, {
          sale_price: 20,
          items: [
            { buy_id: b1.id, quantity: 1 },
            { buy_id: b2.id, quantity: 1 },
          ],
        }),
      );

      const list = soldsRepo.listWithProfit();
      expect(list).toHaveLength(2);

      const byId = new Map(list.map((s) => [s.id, s]));

      const row1 = byId.get(s1.id)!;
      expect(row1.items).toEqual([
        { buy_id: b1.id, product_name: 'sobre pokemon', quantity: 2, unit_cost: 1, unit_assoc: 0 },
      ]);

      const row2 = byId.get(s2.id)!;
      expect(row2.items).toHaveLength(2);
      expect(row2.items[0]).toMatchObject({ buy_id: b1.id, quantity: 1 });
      expect(row2.items[1]).toMatchObject({ buy_id: b2.id, quantity: 1 });
    });

    it('mantiene profit calculado aunque items sea []', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo, { product_name: 'X', purchase_cost: 10, quantity: 5 });
      const s = soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, {
          sale_price: 100,
          associated_costs: 0,
          items: [{ buy_id: b.id, quantity: 1 }],
        }),
      );
      const list = soldsRepo.listWithProfit();
      expect(list[0].id).toBe(s.id);
      expect(list[0].profit).toBe(98);
      expect(list[0].items).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('lista todas', () => {
      const c = makeCustomer(customersRepo);
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b1.id, { items: [{ buy_id: b1.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b2.id, { items: [{ buy_id: b2.id, quantity: 1 }] }),
      );
      expect(soldsRepo.list()).toHaveLength(2);
    });

    it('filtra por customerId', () => {
      const c1 = makeCustomer(customersRepo, 'Ana');
      const c2 = makeCustomer(customersRepo, 'Luis');
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);
      const b3 = makeBuy(buysRepo);

      soldsRepo.createManyWithStockCheck(
        validSold(c1.id, b1.id, { items: [{ buy_id: b1.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c1.id, b2.id, { items: [{ buy_id: b2.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c2.id, b3.id, { items: [{ buy_id: b3.id, quantity: 1 }] }),
      );

      expect(soldsRepo.list({ customerId: c1.id })).toHaveLength(2);
      expect(soldsRepo.list({ customerId: c2.id })).toHaveLength(1);
    });

    it('lista todas las ventas, sin tope (el buscador necesita el histórico completo)', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo, { quantity: 300 });

      for (let i = 0; i < 250; i++) {
        soldsRepo.createManyWithStockCheck(
          validSold(c.id, b.id, { sale_price: 10, items: [{ buy_id: b.id, quantity: 1 }] }),
        );
      }

      expect(soldsRepo.list()).toHaveLength(250);
      expect(soldsRepo.listWithProfit()).toHaveLength(250);
    });

    it('filtra por dateRange (rango cerrado)', () => {
      const c = makeCustomer(customersRepo);
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);
      const b3 = makeBuy(buysRepo);

      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b1.id, { sold_at: '2026-01-01', items: [{ buy_id: b1.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b2.id, { sold_at: '2026-06-01', items: [{ buy_id: b2.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b3.id, { sold_at: '2026-12-01', items: [{ buy_id: b3.id, quantity: 1 }] }),
      );

      const r = soldsRepo.list({ dateRange: { from: '2026-01-01', to: '2026-06-30' } });
      expect(r).toHaveLength(2);
      expect(
        soldsRepo.listWithProfit({ dateRange: { from: '2026-01-01', to: '2026-06-30' } }),
      ).toHaveLength(2);
    });

    it('filtra por from only', () => {
      const c = makeCustomer(customersRepo);
      const b1 = makeBuy(buysRepo);
      const b2 = makeBuy(buysRepo);

      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b1.id, { sold_at: '2026-01-01', items: [{ buy_id: b1.id, quantity: 1 }] }),
      );
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b2.id, { sold_at: '2026-12-01', items: [{ buy_id: b2.id, quantity: 1 }] }),
      );

      const r = soldsRepo.list({ dateRange: { from: '2026-06-01' } });
      expect(r).toHaveLength(1);
    });

    it('el valor del filtro va bindeado: un payload de inyección no ejecuta SQL', () => {
      const c = makeCustomer(customersRepo);
      const b = makeBuy(buysRepo);
      soldsRepo.createManyWithStockCheck(
        validSold(c.id, b.id, { sold_at: '2026-01-01', items: [{ buy_id: b.id, quantity: 1 }] }),
      );

      const r = soldsRepo.list({ dateRange: { from: "2026-01-01'; DROP TABLE solds; --" } });
      expect(r).toHaveLength(0);
      expect(soldsRepo.list()).toHaveLength(1);
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
      const updated = soldsRepo.update(
        created.id,
        validUpdate({ sale_price: 200, associated_costs: 5 }),
      );
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

describe('ventas: importe cobrado (paid_amount)', () => {
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

  it('guarda el importe cobrado en la venta', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 40 }),
    );

    expect(sold.paid_amount).toBe(40);
    expect(soldsRepo.getById(sold.id)?.paid_amount).toBe(40);
  });

  it('sin importe cobrado explícito, la venta se guarda como pagada íntegra', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100 }),
    );

    expect(sold.paid_amount).toBeNull();
    expect(rawPaidAmount(db, sold.id)).toBe(100);
    expect(customerDebt(customersRepo, customer.id)).toBe(0);
  });

  it('un importe cobrado de 0 significa que no te ha pagado nada', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 0 }),
    );

    expect(sold.paid_amount).toBe(0);
    expect(rawPaidAmount(db, sold.id)).toBe(0);
    expect(customerDebt(customersRepo, customer.id)).toBe(100);
  });

  it('un cobro parcial deja la deuda pendiente', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 40 }),
    );

    expect(sold.paid_amount).toBe(40);
    expect(customerDebt(customersRepo, customer.id)).toBe(60);
  });

  it('no permite cobrar más de lo vendido', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    expect(() =>
      soldsRepo.createManyWithStockCheck({
        customer_id: customer.id,
        sale_price: 100,
        associated_costs: 0,
        paid_amount: 100.01,
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    ).toThrow(PaidAmountExceedsPriceError);
  });

  it('cobra exactamente el precio de venta', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 100 }),
    );

    expect(sold.paid_amount).toBeNull();
    expect(rawPaidAmount(db, sold.id)).toBe(100);
    expect(customerDebt(customersRepo, customer.id)).toBe(0);
  });

  it('actualiza el importe cobrado', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100 }),
    );

    const updated = soldsRepo.update(created.id, validUpdate({ paid_amount: 60 }));

    expect(updated?.paid_amount).toBe(60);
    expect(updated?.sale_price).toBe(100);
  });

  it('rechaza cobrar más que el precio almacenado si no viene sale_price', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100 }),
    );

    expect(() => soldsRepo.update(created.id, validUpdate({ paid_amount: 150 }))).toThrow(
      PaidAmountExceedsPriceError,
    );
    expect(soldsRepo.getById(created.id)?.paid_amount).toBeNull();
  });

  it('rechaza bajar el precio de venta por debajo de lo ya cobrado', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 80 }),
    );

    expect(() => soldsRepo.update(created.id, validUpdate({ sale_price: 50 }))).toThrow(
      PaidAmountExceedsPriceError,
    );
    expect(soldsRepo.getById(created.id)?.sale_price).toBe(100);
  });

  it('el importe cobrado no cambia el beneficio de la venta', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo, { product_name: 'Funda', purchase_cost: 50, quantity: 1 });

    const sold = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 100 }),
    );

    const [row] = soldsRepo.listWithProfit();
    expect(row?.profit).toBe(50);
    expect(row?.paid_amount).toBeNull();
    expect(sold.paid_amount).toBeNull();
  });

  it('volver a null deja la venta pagada íntegra otra vez', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 40 }),
    );

    const updated = soldsRepo.update(created.id, validUpdate({ paid_amount: null }));

    expect(updated?.paid_amount).toBeNull();
    expect(customerDebt(customersRepo, customer.id)).toBe(0);
  });

  it('cambiar el precio de una venta pagada íntegra la deja sin deuda', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100 }),
    );

    const updated = soldsRepo.update(created.id, validUpdate({ sale_price: 150 }));

    expect(updated?.sale_price).toBe(150);
    expect(updated?.paid_amount).toBeNull();
    expect(customerDebt(customersRepo, customer.id)).toBe(0);
  });

  it('bajar el precio por debajo de lo cobrado sigue rechazándose', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo);
    const created = soldsRepo.createManyWithStockCheck(
      validSold(customer.id, buy.id, { sale_price: 100, paid_amount: 80 }),
    );

    expect(() => soldsRepo.update(created.id, validUpdate({ sale_price: 50 }))).toThrow(
      PaidAmountExceedsPriceError,
    );
    expect(soldsRepo.getById(created.id)?.sale_price).toBe(100);
  });
});

describe('schemas solds: paid_amount', () => {
  it('create con paid_amount mayor que sale_price → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 100,
      paid_amount: 101,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('create sin paid_amount → sin importe informado', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 100,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paid_amount).toBeUndefined();
  });

  it('create con paid_amount null → acepta (pago íntegro)', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 100,
      paid_amount: null,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paid_amount).toBeNull();
  });

  it('create con paid_amount negativo → rechaza', () => {
    const r = CreateSoldSchema.safeParse({
      customer_id: 1,
      sale_price: 100,
      paid_amount: -1,
      items: [{ buy_id: 1, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('update con paid_amount y sale_price → rechaza si el cobrado supera el precio', () => {
    const r = UpdateSoldSchema.safeParse({ sale_price: 100, paid_amount: 101 });
    expect(r.success).toBe(false);
  });

  it('update solo con paid_amount → ok (el precio se valida contra el valor almacenado)', () => {
    const r = UpdateSoldSchema.safeParse({ paid_amount: 101 });
    expect(r.success).toBe(true);
  });
});

process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

const { createApp } = await import('../app.js');
const { once } = await import('node:events');

describe('contrato HTTP del importe cobrado', () => {
  let db: Database;
  let server: import('node:http').Server;
  let baseUrl: string;
  let soldsRepo: ReturnType<typeof createSoldsRepo>;
  let customersRepo: ReturnType<typeof createCustomersRepo>;
  let buysRepo: ReturnType<typeof createBuysRepo>;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    buysRepo = createBuysRepo(db);
    soldsRepo = createSoldsRepo(db);
    customersRepo = createCustomersRepo(db);
    const app = createApp({ buysRepo, soldsRepo, customersRepo });
    server = app.listen(0);
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
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

  function seedCustomer() {
    return customersRepo.create({ name: 'Ana' });
  }

  function seedBuy() {
    return buysRepo.create({
      product_name: 'Camiseta',
      purchase_cost: 20,
      quantity: 5,
      associated_costs: 0,
    });
  }

  it('POST /api/solds acepta el importe cobrado', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();

    const res = await api('POST', '/api/solds', {
      customer_id: customer.id,
      sale_price: 100,
      paid_amount: 40,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    expect(res.status).toBe(201);
    expect((res.body?.data as { paid_amount: number }).paid_amount).toBe(40);
  });

  it('POST /api/solds con importe cobrado mayor que el precio devuelve 400', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();

    const res = await api('POST', '/api/solds', {
      customer_id: customer.id,
      sale_price: 100,
      paid_amount: 150,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('El importe cobrado no puede superar el precio de venta');
  });

  it('POST /api/solds sin importe cobrado guarda la venta como pagada íntegra', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();

    const res = await api('POST', '/api/solds', {
      customer_id: customer.id,
      sale_price: 100,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    expect(res.status).toBe(201);
    expect((res.body?.data as { paid_amount: number | null }).paid_amount).toBeNull();
  });

  it('PATCH /api/solds/:id actualiza el importe cobrado', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();
    const sold = soldsRepo.createManyWithStockCheck({
      customer_id: customer.id,
      sale_price: 100,
      associated_costs: 0,
      paid_amount: 0,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    const res = await api('PATCH', `/api/solds/${sold.id}`, { paid_amount: 60 });

    expect(res.status).toBe(200);
    expect((res.body?.data as { paid_amount: number }).paid_amount).toBe(60);
  });

  it('PATCH /api/solds/:id con importe cobrado mayor que el precio almacenado devuelve 400', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();
    const sold = soldsRepo.createManyWithStockCheck({
      customer_id: customer.id,
      sale_price: 100,
      associated_costs: 0,
      paid_amount: 0,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    const res = await api('PATCH', `/api/solds/${sold.id}`, { paid_amount: 150 });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('El importe cobrado no puede superar el precio de venta');
    expect(soldsRepo.getById(sold.id)?.paid_amount).toBe(0);
  });

  it('PATCH /api/solds/:id con importe cobrado mayor que el nuevo precio devuelve 400', async () => {
    const customer = seedCustomer();
    const buy = seedBuy();
    const sold = soldsRepo.createManyWithStockCheck({
      customer_id: customer.id,
      sale_price: 100,
      associated_costs: 0,
      paid_amount: 0,
      sold_at: '2026-10-20',
      items: [{ buy_id: buy.id, quantity: 1 }],
    });

    const res = await api('PATCH', `/api/solds/${sold.id}`, { sale_price: 50, paid_amount: 80 });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('El importe cobrado no puede superar el precio de venta');
  });
});
