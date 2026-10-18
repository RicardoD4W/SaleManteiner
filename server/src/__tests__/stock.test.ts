/**
 * Tests de validación de stock transaccional (S7 del feature) y prorrateo por unidad (S3, S13).
 *
 * Casos cubiertos:
 *  - Stock insuficiente: lanza StockInsufficientError con detalle del producto.
 *  - Pack multi-producto: venta con 2 items de 2 buys distintas.
 *  - Prorrateo por unidad: compra de 3 unidades a 90€ → unit_cost = 30€;
 *    venta de 2 unidades → coste consumido = 60€ → beneficio coherente.
 *  - Top compradores: ranking por total_gastado.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import type { StockInsufficientError } from '../repo/solds-repo.js';
import { round2 } from '../lib/round.js';
import { CreateBuyInput } from '../schemas/buys.js';
import { CreateSoldInput } from '../schemas/solds.js';
import { CreateCustomerInput } from '../schemas/customers.js';

const CreateBuySchema = CreateBuyInput;
const CreateSoldSchema = CreateSoldInput;
const CreateCustomerSchema = CreateCustomerInput;

function makeBuy(repo: ReturnType<typeof createBuysRepo>, overrides: Record<string, unknown> = {}) {
  return repo.create(CreateBuySchema.parse({ product_name: 'X', ...overrides }));
}

function makeCustomer(repo: ReturnType<typeof createCustomersRepo>, name = 'Test') {
  return repo.create(CreateCustomerSchema.parse({ name }));
}

function makeSold(
  repo: ReturnType<typeof createSoldsRepo>,
  customerId: number,
  buyId: number,
  quantity: number,
  overrides: Record<string, unknown> = {},
) {
  return repo.createManyWithStockCheck(
    CreateSoldSchema.parse({
      customer_id: customerId,
      sale_price: 0,
      items: [{ buy_id: buyId, quantity }],
      ...overrides,
    }),
  );
}

describe('stock insuficiente (S7)', () => {
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

  it('lanza StockInsufficientError cuando la cantidad solicitada > disponible', () => {
    const customer = makeCustomer(customersRepo, 'Juan');
    const buy = makeBuy(buysRepo, { product_name: 'Funda', quantity: 3 });

    try {
      soldsRepo.createManyWithStockCheck(
        CreateSoldSchema.parse({
          customer_id: customer.id,
          sale_price: 50,
          items: [{ buy_id: buy.id, quantity: 5 }], // 5 > 3 disponibles
        }),
      );
      expect.fail('Expected StockInsufficientError to be thrown');
    } catch (err) {
      const stockErr = err as Partial<StockInsufficientError> & Error;
      expect(stockErr.error).toBe('Stock insuficiente');
      expect(stockErr.items).toHaveLength(1);
      expect(stockErr.items![0]).toMatchObject({
        buy_id: buy.id,
        product_name: 'Funda',
        disponibles: 3,
        solicitado: 5,
      });
    }
  });

  it('lanza error si el buy_id no existe', () => {
    const customer = makeCustomer(customersRepo);

    try {
      soldsRepo.createManyWithStockCheck(
        CreateSoldSchema.parse({
          customer_id: customer.id,
          sale_price: 50,
          items: [{ buy_id: 99999, quantity: 1 }],
        }),
      );
      expect.fail('Expected StockInsufficientError to be thrown');
    } catch (err) {
      const stockErr = err as Partial<StockInsufficientError> & Error;
      expect(stockErr.error).toBe('Stock insuficiente');
      expect(stockErr.items![0]).toMatchObject({
        buy_id: 99999,
        disponibles: 0,
        solicitado: 1,
      });
    }
  });

  it('si hay múltiples items con stock insuficiente, reporta todos', () => {
    const customer = makeCustomer(customersRepo);
    const buy1 = makeBuy(buysRepo, { product_name: 'A', quantity: 2 });
    const buy2 = makeBuy(buysRepo, { product_name: 'B', quantity: 1 });

    try {
      soldsRepo.createManyWithStockCheck(
        CreateSoldSchema.parse({
          customer_id: customer.id,
          sale_price: 100,
          items: [
            { buy_id: buy1.id, quantity: 5 }, // pide 5, hay 2
            { buy_id: buy2.id, quantity: 3 }, // pide 3, hay 1
          ],
        }),
      );
      expect.fail('Expected StockInsufficientError to be thrown');
    } catch (err) {
      const stockErr = err as Partial<StockInsufficientError> & Error;
      expect(stockErr.items).toHaveLength(2);
      expect(stockErr.items!.map((i: { buy_id: number }) => i.buy_id)).toContain(buy1.id);
      expect(stockErr.items!.map((i: { buy_id: number }) => i.buy_id)).toContain(buy2.id);
    }
  });

  it('venta exactamente igual al stock disponible → OK', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo, { product_name: 'X', quantity: 5 });

    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 100,
        items: [{ buy_id: buy.id, quantity: 5 }],
      }),
    );
    expect(sold.id).toBeGreaterThan(0);
  });

  it('vender resta el stock disponible', () => {
    const customer = makeCustomer(customersRepo);
    const buy = makeBuy(buysRepo, { product_name: 'X', quantity: 5 });
    expect(buysRepo.getWithStock()[0]!.disponibles).toBe(5);

    makeSold(soldsRepo, customer.id, buy.id, 3, { sale_price: 50 });
    expect(buysRepo.getWithStock()[0]!.disponibles).toBe(2);

    makeSold(soldsRepo, customer.id, buy.id, 2, { sale_price: 40 });
    expect(buysRepo.getWithStock()).toHaveLength(0); // ya no queda stock
  });
});

describe('pack multi-producto (S5, S7)', () => {
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

  it('crea una venta con 2 items de 2 buys distintas', () => {
    const customer = makeCustomer(customersRepo, 'Ana');
    const buy1 = makeBuy(buysRepo, { product_name: 'Funda', purchase_cost: 10, quantity: 5 });
    const buy2 = makeBuy(buysRepo, { product_name: 'Cargador', purchase_cost: 20, quantity: 3 });

    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 80,
        associated_costs: 3,
        items: [
          { buy_id: buy1.id, quantity: 2 }, // 2 fundas
          { buy_id: buy2.id, quantity: 1 }, // 1 cargador
        ],
      }),
    );

    expect(sold.id).toBeGreaterThan(0);
    expect(sold.sale_price).toBe(80);

    const detail = soldsRepo.getByIdWithItems(sold.id);
    expect(detail!.items).toHaveLength(2);
    expect(detail!.items.map((i) => i.product_name).sort()).toEqual(['Cargador', 'Funda']);
    expect(detail!.items.map((i) => i.quantity).sort()).toEqual([1, 2]);
  });

  it('stock se descuenta correctamente en pack de 2 items', () => {
    const customer = makeCustomer(customersRepo);
    const buy1 = makeBuy(buysRepo, { product_name: 'A', quantity: 5 });
    const buy2 = makeBuy(buysRepo, { product_name: 'B', quantity: 3 });

    soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 100,
        items: [
          { buy_id: buy1.id, quantity: 2 },
          { buy_id: buy2.id, quantity: 1 },
        ],
      }),
    );

    const stock = buysRepo.getWithStock();
    const stockMap = new Map(stock.map((b) => [b.product_name, b.disponibles]));
    expect(stockMap.get('A')).toBe(3); // 5 - 2
    expect(stockMap.get('B')).toBe(2); // 3 - 1
  });
});

describe('prorrateo por unidad (S3, S13)', () => {
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

  it('unit_cost = round2(purchase_cost / quantity)', () => {
    // Compra: 3 unidades por 90€ total → unit_cost = 30€
    const buy = makeBuy(buysRepo, { product_name: 'Pack 3', purchase_cost: 90, quantity: 3 });
    const customer = makeCustomer(customersRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 75,
        items: [{ buy_id: buy.id, quantity: 2 }], // vende 2 de 3
      }),
    );

    const detail = soldsRepo.getByIdWithItems(sold.id)!;
    expect(detail.items[0].unit_cost).toBe(30); // 90 / 3 = 30
  });

  it('unit_cost redondeado con round2 mitiga IEEE 754', () => {
    // Compra: 3 unidades por 10€ → unit_cost = 3.333...
    const buy = makeBuy(buysRepo, { product_name: 'X', purchase_cost: 10, quantity: 3 });
    const customer = makeCustomer(customersRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 12,
        items: [{ buy_id: buy.id, quantity: 1 }],
      }),
    );

    const detail = soldsRepo.getByIdWithItems(sold.id)!;
    // round2(10/3) = round2(3.333333...) = 3.33
    expect(detail.items[0].unit_cost).toBe(3.33);
  });

  it('associated_costs prorrateados = round2(associated_costs / quantity)', () => {
    // Compra: 5 unidades, 25€ de gastos (5€/u)
    const buy = makeBuy(buysRepo, {
      product_name: 'X',
      purchase_cost: 100,
      associated_costs: 25,
      quantity: 5,
    });
    const customer = makeCustomer(customersRepo);

    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 60,
        items: [{ buy_id: buy.id, quantity: 2 }],
      }),
    );

    const detail = soldsRepo.getByIdWithItems(sold.id)!;
    expect(detail.items[0].unit_assoc).toBe(5); // 25 / 5 = 5
  });

  it('beneficio por venta = round2(sale_price - associated_costs - sum(qty * unit_cost) - sum(qty * unit_assoc))', () => {
    // Compra: 3 unidades, 90€ + 9€ gastos = 99€ total → unit = 33€ + 3€ gastos/u
    const buy = makeBuy(buysRepo, {
      product_name: 'Pack',
      purchase_cost: 99,
      associated_costs: 9,
      quantity: 3,
    });
    const customer = makeCustomer(customersRepo);

    // Vender 2 unidades a 100€ + 5€ gastos de envío
    const sold = soldsRepo.createManyWithStockCheck(
      CreateSoldSchema.parse({
        customer_id: customer.id,
        sale_price: 100,
        associated_costs: 5,
        items: [{ buy_id: buy.id, quantity: 2 }],
      }),
    );

    const detail = soldsRepo.getByIdWithItems(sold.id)!;
    const item = detail.items[0];

    // unit_cost = round2(99/3) = 33 (SQL: ROUND(99/3, 2) = 33.00)
    expect(item.unit_cost).toBe(33);
    // unit_assoc = round2(9/3) = 3
    expect(item.unit_assoc).toBe(3);

    // Beneficio = round2(100 - 5 - 2*33 - 2*3) = round2(23) = 23
    // (unit_cost y unit_assoc en SQL ya están redondeados a 2 decimales)
    const expectedBenefit = round2(100 - 5 - 2 * item.unit_cost - 2 * item.unit_assoc);
    expect(expectedBenefit).toBe(23);
  });
});

describe('top compradores (S8)', () => {
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

  it('topBuyers ordena por total_gastado DESC', () => {
    const ana = makeCustomer(customersRepo, 'Ana');
    const luis = makeCustomer(customersRepo, 'Luis');
    const pedro = makeCustomer(customersRepo, 'Pedro');
    const b = makeBuy(buysRepo, { product_name: 'X', quantity: 100 });

    // Ana: 2 ventas, 100+150 = 250€
    makeSold(soldsRepo, ana.id, b.id, 1, { sale_price: 100 });
    makeSold(soldsRepo, ana.id, b.id, 1, { sale_price: 150 });

    // Luis: 1 venta, 300€
    makeSold(soldsRepo, luis.id, b.id, 1, { sale_price: 300 });

    // Pedro: 1 venta, 50€
    makeSold(soldsRepo, pedro.id, b.id, 1, { sale_price: 50 });

    const stats = soldsRepo.statsDashboard();
    const buyers = stats.topBuyers;

    expect(buyers[0]).toMatchObject({ customer_name: 'Luis', total_gastado: 300, ventas: 1 });
    expect(buyers[1]).toMatchObject({ customer_name: 'Ana', total_gastado: 250, ventas: 2 });
    expect(buyers[2]).toMatchObject({ customer_name: 'Pedro', total_gastado: 50, ventas: 1 });
  });

  it('topBuyers es top 10 (no más)', () => {
    // Crear 15 clientes con 1 venta cada uno
    for (let i = 0; i < 15; i++) {
      const c = makeCustomer(customersRepo, `Cliente ${i}`);
      const b = makeBuy(buysRepo, { product_name: 'X', quantity: 10 });
      makeSold(soldsRepo, c.id, b.id, 1, { sale_price: i + 1 });
    }

    const stats = soldsRepo.statsDashboard();
    expect(stats.topBuyers).toHaveLength(10);
    // El primero debería ser el que más gastó (Cliente 14 → 15€)
    expect(stats.topBuyers[0]!.customer_name).toBe('Cliente 14');
    expect(stats.topBuyers[0]!.total_gastado).toBe(15);
  });

  it('cliente sin ventas no aparece en topBuyers', () => {
    // Cliente sin ventas
    makeCustomer(customersRepo, 'Solo mira');
    const c = makeCustomer(customersRepo, 'Comprador');
    const b = makeBuy(buysRepo, { product_name: 'X', quantity: 10 });
    makeSold(soldsRepo, c.id, b.id, 1, { sale_price: 50 });

    const stats = soldsRepo.statsDashboard();
    const names = stats.topBuyers.map((b) => b.customer_name);
    expect(names).not.toContain('Solo mira');
    expect(names).toContain('Comprador');
  });
});

describe('round2 (S2)', () => {
  it('redondea 0.1 + 0.2 → 0.3 (sin error IEEE 754)', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('redondea 0.06 * 5 → 0.3', () => {
    expect(round2(0.06 * 5)).toBe(0.3);
  });

  it('redondea 33.333 → 33.33', () => {
    expect(round2(33.333)).toBe(33.33);
  });

  it('redondea 0.666 → 0.67', () => {
    expect(round2(0.666)).toBe(0.67);
  });

  it('no cambia un número ya redondeado', () => {
    expect(round2(99.99)).toBe(99.99);
  });

  it('funciona en cadena: round2(round2(x) + round2(y))', () => {
    const a = round2(10 / 3); // 3.33
    const b = round2(10 / 3); // 3.33
    expect(round2(a + b)).toBe(6.66);
  });
});
