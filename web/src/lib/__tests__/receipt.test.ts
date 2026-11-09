import { describe, expect, it } from 'vitest';
import {
  receiptDate,
  receiptFileName,
  receiptLines,
  receiptTotals,
  type ReceiptLine,
} from '@/lib/receipt';
import type { SaleItemOutput } from '@/schemas/solds';

const items: SaleItemOutput[] = [
  {
    buy_id: 10,
    product_name: 'iPhone 15',
    quantity: 2,
    unit_cost: 400,
    unit_assoc: 5,
  },
  {
    buy_id: 11,
    product_name: 'Funda',
    quantity: 1,
    unit_cost: 3,
    unit_assoc: 0,
  },
];

describe('receiptLines', () => {
  it('devuelve una línea por producto vendido', () => {
    expect(receiptLines(items)).toEqual<ReceiptLine[]>([
      { key: '10', buyId: 10, productName: 'iPhone 15', quantity: 2 },
      { key: '11', buyId: 11, productName: 'Funda', quantity: 1 },
    ]);
  });

  it('devuelve una lista vacía si la venta no tiene productos', () => {
    expect(receiptLines([])).toEqual([]);
  });
});

describe('receiptTotals', () => {
  it('suma el precio de venta como total', () => {
    expect(receiptTotals(120, null)).toEqual({ total: 120, paid: null, pending: 0 });
  });

  it('calcula el pendiente cuando hay importe cobrado', () => {
    expect(receiptTotals(120, 50)).toEqual({ total: 120, paid: 50, pending: 70 });
  });

  it('redondea el pendiente a dos decimales', () => {
    expect(receiptTotals(0.3, 0.1)).toEqual({ total: 0.3, paid: 0.1, pending: 0.2 });
  });
});

describe('receiptDate', () => {
  it('usa la fecha de venta cuando existe', () => {
    expect(receiptDate('2026-11-05', '2026-11-01T10:00:00.000Z')).toBe('05/11/2026');
  });

  it('usa la fecha de registro cuando la venta no tiene fecha', () => {
    expect(receiptDate(null, '2026-11-01T10:00:00.000Z')).toBe('01/11/2026');
  });
});

describe('receiptFileName', () => {
  it('usa el número de venta y la fecha de venta', () => {
    expect(receiptFileName(3, '2026-11-05', '2026-11-01T10:00:00.000Z')).toBe(
      'Factura Nº3 _ 05-11-2026',
    );
  });

  it('usa la fecha de registro cuando la venta no tiene fecha', () => {
    expect(receiptFileName(3, null, '2026-11-01T10:00:00.000Z')).toBe('Factura Nº3 _ 01-11-2026');
  });

  it('evita la barra que Windows no admite en nombres de archivo', () => {
    expect(receiptFileName(3, '2026-11-05', '2026-11-01T10:00:00.000Z')).not.toContain('/');
  });
});
