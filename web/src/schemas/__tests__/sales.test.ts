/**
 * Tests de los schemas Zod del frontend.
 *
 * Cubre:
 *  - CreateSaleInput: defaults, .strict(), validación de enteros no negativos
 *  - UpdateSaleInput: campos opcionales, .strict()
 *  - Sale: RowId positivo, boolean (no string), round-trip
 *
 * Refleja el contrato con el backend (los schemas están duplicados
 * server/web — ver AGENTS.md §13 "Schemas Zod duplicados").
 */
import { describe, expect, it } from 'vitest';
import { CreateSaleInput, Sale, UpdateSaleInput } from '../sales.js';
import { saleFixture } from '../../test-utils/fixtures.js';

describe('CreateSaleInput', () => {
  it('aplica defaults cuando solo se pasa product_name', () => {
    const parsed = CreateSaleInput.parse({ product_name: 'Libro' });
    expect(parsed.product_name).toBe('Libro');
    expect(parsed.buyer_name).toBeUndefined();
    expect(parsed.cost_cents).toBe(0);
    expect(parsed.price_cents).toBe(0);
    expect(parsed.associated_costs_cents).toBe(0);
    expect(parsed.sold).toBe(false);
    expect(parsed.notes).toBeUndefined();
  });

  it('acepta todos los campos y los preserva', () => {
    const parsed = CreateSaleInput.parse({
      product_name: 'iPhone 12',
      buyer_name: 'Juan',
      cost_cents: 15000,
      price_cents: 25000,
      associated_costs_cents: 500,
      sold: true,
      sold_at: '2026-01-15T10:00:00.000Z',
      purchase_date: '2026-01-05',
      notes: 'En caja',
    });
    expect(parsed.product_name).toBe('iPhone 12');
    expect(parsed.buyer_name).toBe('Juan');
    expect(parsed.cost_cents).toBe(15000);
    expect(parsed.price_cents).toBe(25000);
    expect(parsed.associated_costs_cents).toBe(500);
    expect(parsed.sold).toBe(true);
    expect(parsed.sold_at).toBe('2026-01-15T10:00:00.000Z');
    expect(parsed.purchase_date).toBe('2026-01-05');
    expect(parsed.notes).toBe('En caja');
  });

  it('rechaza claves extra (.strict())', () => {
    const result = CreateSaleInput.safeParse({
      product_name: 'X',
      desconocido: 'boom',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod marca la clave como "unrecognized"
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rechaza cost_cents negativo', () => {
    const result = CreateSaleInput.safeParse({
      product_name: 'X',
      cost_cents: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza cost_cents no entero (1.5)', () => {
    const result = CreateSaleInput.safeParse({
      product_name: 'X',
      cost_cents: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza product_name vacío (ShortText requiere min 1)', () => {
    const result = CreateSaleInput.safeParse({ product_name: '' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateSaleInput', () => {
  it('parse({}) devuelve {} (todos los campos son opcionales)', () => {
    const parsed = UpdateSaleInput.parse({});
    expect(parsed).toEqual({});
  });

  it('acepta campos parciales sin aplicarlos como defaults', () => {
    // Diferencia clave con Create: no hay defaults aplicados.
    const parsed = UpdateSaleInput.parse({ buyer_name: 'Ana' });
    expect(parsed.buyer_name).toBe('Ana');
    expect(parsed.cost_cents).toBeUndefined();
    expect(parsed.price_cents).toBeUndefined();
    expect(parsed.sold).toBeUndefined();
    expect(parsed.product_name).toBeUndefined();
  });

  it('acepta update con múltiples campos', () => {
    const parsed = UpdateSaleInput.parse({
      price_cents: 30000,
      sold: true,
      notes: 'Vendido el lunes',
    });
    expect(parsed.price_cents).toBe(30000);
    expect(parsed.sold).toBe(true);
    expect(parsed.notes).toBe('Vendido el lunes');
    expect(parsed.cost_cents).toBeUndefined();
  });

  it('rechaza claves extra (.strict())', () => {
    const result = UpdateSaleInput.safeParse({
      price_cents: 100,
      inventado: 'boom',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('rechaza price_cents negativo', () => {
    const result = UpdateSaleInput.safeParse({ price_cents: -1 });
    expect(result.success).toBe(false);
  });
});

describe('Sale (output)', () => {
  it('parsea una Sale válida', () => {
    const parsed = Sale.parse(saleFixture);
    expect(parsed.id).toBe(1);
    expect(parsed.product_name).toBe('iPhone 12 64GB');
    expect(parsed.sold).toBe(true);
    expect(parsed.notes).toBe('En caja original');
    expect(parsed.created_at).toBe('2026-10-01T10:00:00.000Z');
    expect(parsed.sold_at).toBe('2026-10-05T14:30:00.000Z');
  });

  it('rechaza id <= 0 (RowId positivo)', () => {
    const result = Sale.safeParse({ ...saleFixture, id: -1 });
    expect(result.success).toBe(false);
    const result2 = Sale.safeParse({ ...saleFixture, id: 0 });
    expect(result2.success).toBe(false);
  });

  it('rechaza sold como string en vez de boolean', () => {
    const result = Sale.safeParse({ ...saleFixture, sold: 'true' });
    expect(result.success).toBe(false);
  });

  it('acepta sold_at = null (no vendido todavía)', () => {
    const parsed = Sale.parse({ ...saleFixture, sold_at: null });
    expect(parsed.sold_at).toBeNull();
  });

  it('acepta buyer_name = null', () => {
    const parsed = Sale.parse({ ...saleFixture, buyer_name: null });
    expect(parsed.buyer_name).toBeNull();
  });

  it('round-trip Sale → JSON → Sale preserva el objeto', () => {
    const json = JSON.parse(JSON.stringify(saleFixture));
    const reparsed = Sale.parse(json);
    expect(reparsed).toEqual(saleFixture);
  });

  it('rechaza created_at mal formado (no es ISO 8601)', () => {
    const result = Sale.safeParse({ ...saleFixture, created_at: 'ayer' });
    expect(result.success).toBe(false);
  });
});