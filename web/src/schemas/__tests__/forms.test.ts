import { describe, expect, it } from 'vitest';
import { BuyFormSchema, CustomerFormSchema, SoldFieldsSchema, SoldFormSchema } from '../forms';

const buyValido = {
  product_name: 'Funda iPhone 15',
  purchase_cost: 45.5,
  quantity: 20,
  associated_costs: 3.2,
  purchase_date: '2026-10-02',
};

const ventaValida = {
  customer_id: 1,
  sale_price: 120,
  associated_costs: 4.5,
  sold_at: '2026-10-02',
  notes: '',
};

function primerMensaje(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}) {
  return result.error?.issues[0]?.message;
}

describe('los schemas de los forms (la fuente de la verdad de los forms)', () => {
  it('un producto de solo espacios no es válido', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, product_name: '   ' });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('El producto es obligatorio');
  });

  it('un nombre de cliente de solo espacios no es válido', () => {
    const result = CustomerFormSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('El nombre es obligatorio');
  });

  it('un importe con más de 2 decimales no es válido', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, purchase_cost: 10.005 });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('Máximo 2 decimales');
  });

  it('un importe negativo no es válido', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, associated_costs: -1 });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('No puede ser negativo');
  });

  it('la fecha vacía es válida (el form la manda como undefined)', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, purchase_date: '' });

    expect(result.success).toBe(true);
  });

  it('una fecha que existe en el calendario es válida', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, purchase_date: '2026-10-02' });

    expect(result.success).toBe(true);
  });

  it('el 29 de febrero solo vale en los años bisiestos', () => {
    const bisiesto = BuyFormSchema.safeParse({ ...buyValido, purchase_date: '2028-02-29' });
    const noBisiesto = BuyFormSchema.safeParse({ ...buyValido, purchase_date: '2026-02-29' });

    expect(bisiesto.success).toBe(true);
    expect(noBisiesto.success).toBe(false);
  });

  it('la fecha tiene que existir en el calendario', () => {
    const result = BuyFormSchema.safeParse({ ...buyValido, purchase_date: '2026-02-30' });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('Fecha inválida (YYYY-MM-DD)');
  });

  it('una venta necesita al menos un producto', () => {
    const result = SoldFormSchema.safeParse({ ...ventaValida, items: [] });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('Seleccioná al menos un producto');
  });

  it('una venta con productos es válida', () => {
    const result = SoldFormSchema.safeParse({
      ...ventaValida,
      items: [{ buy_id: 1, product_name: 'Funda iPhone 15', quantity: 1, max: 3 }],
    });

    expect(result.success).toBe(true);
  });

  it('el cliente de la venta es obligatorio', () => {
    const result = SoldFieldsSchema.safeParse({ ...ventaValida, customer_id: undefined });

    expect(result.success).toBe(false);
    expect(primerMensaje(result)).toBe('El cliente es obligatorio');
  });
});
