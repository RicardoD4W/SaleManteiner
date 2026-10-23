import { describe, expect, it } from 'vitest';
import { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';
import { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';
import { CreateCustomerInput } from '../schemas/customers.js';

describe('LocalDate', () => {
  it('acepta una fecha válida', () => {
    expect(
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '2026-10-20' }).purchase_date,
    ).toBe('2026-10-20');
  });

  it('acepta el 29 de febrero en un año bisiesto', () => {
    expect(
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '2028-02-29' }).purchase_date,
    ).toBe('2028-02-29');
  });

  it('rechaza el 29 de febrero en un año que no es bisiesto', () => {
    expect(() =>
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '2026-02-29' }),
    ).toThrow();
  });

  it('rechaza un mes fuera de rango', () => {
    expect(() =>
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '2026-13-45' }),
    ).toThrow();
  });

  it('rechaza un día que no existe en el mes', () => {
    expect(() =>
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '2026-04-31' }),
    ).toThrow();
  });

  it('rechaza un formato que no es YYYY-MM-DD', () => {
    expect(() =>
      CreateBuyInput.parse({ product_name: 'X', purchase_date: '20/10/2026' }),
    ).toThrow();
  });
});

describe('ShortText', () => {
  it('rechaza un texto vacío', () => {
    expect(() => CreateCustomerInput.parse({ name: '' })).toThrow();
  });

  it('rechaza un texto de solo espacios', () => {
    expect(() => CreateCustomerInput.parse({ name: '   ' })).toThrow();
  });

  it('no transforma el valor guardado (no hace trim)', () => {
    expect(CreateCustomerInput.parse({ name: ' Ana ' }).name).toBe(' Ana ');
  });
});

describe('EuroMoney en create y update', () => {
  it('create acepta 2 decimales y rechaza 3', () => {
    expect(CreateBuyInput.parse({ product_name: 'X', purchase_cost: 10.5 }).purchase_cost).toBe(
      10.5,
    );
    expect(() => CreateBuyInput.parse({ product_name: 'X', purchase_cost: 10.005 })).toThrow();
  });

  it('update acepta 2 decimales y rechaza 3', () => {
    expect(UpdateBuyInput.parse({ purchase_cost: 10.5 }).purchase_cost).toBe(10.5);
    expect(() => UpdateBuyInput.parse({ purchase_cost: 10.005 })).toThrow();
  });

  it('update de venta acepta 2 decimales y rechaza 3', () => {
    expect(UpdateSoldInput.parse({ sale_price: 20.25 }).sale_price).toBe(20.25);
    expect(() => UpdateSoldInput.parse({ sale_price: 20.255 })).toThrow();
  });

  it('create de venta acepta 2 decimales y rechaza 3', () => {
    const item = { buy_id: 1, quantity: 1 };
    expect(
      CreateSoldInput.parse({ customer_id: 1, sale_price: 20.25, items: [item] }).sale_price,
    ).toBe(20.25);
    expect(() =>
      CreateSoldInput.parse({ customer_id: 1, sale_price: 20.255, items: [item] }),
    ).toThrow();
  });
});
