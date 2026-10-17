/**
 * Tests del serializer CSV (Fase 6).
 *
 * Cubre las decisiones de S2-S7 del feature doc:
 *  - Headers lowercase snake_case en el orden correcto.
 *  - BOM al inicio.
 *  - Booleanos como `true`/`false` (lowercase string).
 *  - Null/undefined → celda vacía.
 *  - Escape RFC 4180: comilla si hay `,`, `"`, `\n`, `\r`.
 *  - Importes como string de entero (no formateados como euros).
 */
import { describe, expect, it } from 'vitest';
import { serializeSalesToCsv, CSV_HEADERS } from '../csv-export.js';
import { Sale } from '../schemas/sales.js';
import type { Sale as SaleType } from '../schemas/sales.js';

/**
 * Overrides permisivos: cualquier subset de las claves de Sale. Los valores
 * son `unknown` para que el caller pueda pasar `15000` o `'iPhone'` sin
 * pelearse con los brands `Cents` / `RowId`. Zod se encarga de marcarlos
 * al final con `Sale.parse`.
 */
type SaleFixtureOverrides = { [K in keyof SaleType]?: unknown };

function saleFixture(overrides: SaleFixtureOverrides = {}): SaleType {
  const raw = {
    id: 1,
    product_name: 'iPhone 12 64GB',
    buyer_name: 'Juan Pérez',
    cost_cents: 15000,
    price_cents: 25000,
    associated_costs_cents: 500,
    sold: true,
    purchase_date: '2026-09-28',
    notes: 'En caja original',
    created_at: '2026-10-01T10:00:00.000Z',
    sold_at: '2026-10-05T14:30:00.000Z',
    ...overrides,
  };
  return Sale.parse(raw);
}

describe('serializeSalesToCsv (Fase 6)', () => {
  it('arranca con BOM UTF-8 para compat con Excel', () => {
    const csv = serializeSalesToCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('exporta los headers en orden snake_case y lowercase', () => {
    const csv = serializeSalesToCsv([]);
    // Después del BOM.
    const firstLine = csv.slice(1).split('\r\n')[0]!;
    expect(firstLine).toBe(CSV_HEADERS.join(','));
    expect(CSV_HEADERS).toEqual([
      'product_name',
      'buyer_name',
      'cost_cents',
      'price_cents',
      'associated_costs_cents',
      'sold',
      'purchase_date',
      'sold_at',
      'notes',
    ]);
  });

  it('serializa una fila completa con todos los campos', () => {
    const csv = serializeSalesToCsv([saleFixture()]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      'iPhone 12 64GB,Juan Pérez,15000,25000,500,true,2026-09-28,2026-10-05T14:30:00.000Z,En caja original',
    );
  });

  it('serializa booleanos como `true` / `false` (no `1` / `0`)', () => {
    const csv = serializeSalesToCsv([saleFixture({ sold: false })]);
    const row = csv.slice(1).split('\r\n')[1]!;
    expect(row).toContain(',false,');
  });

  it('serializa nulls como celdas vacías', () => {
    const csv = serializeSalesToCsv([
      saleFixture({
        buyer_name: null,
        purchase_date: null,
        sold_at: null,
        notes: null,
      }),
    ]);
    // Esperado: ,,,,,,,, (5 comas de campos nulos... wait, depende del offset)
    // Estructura: product_name|buyer_name|cost|price|assoc_costs|sold|purchase_date|sold_at|notes
    // buyer_name = '' (1)
    // purchase_date = '' (1)
    // sold_at = '' (1)
    // notes = '' (1)
    const row = csv.slice(1).split('\r\n')[1]!;
    // Recuento: 9 campos, separados por 8 comas. Celdas vacías: 4 (buyer_name, purchase_date, sold_at, notes).
    // Esperado: "iPhone 12 64GB,,15000,25000,500,true,,,"
    expect(row).toBe('iPhone 12 64GB,,15000,25000,500,true,,,');
  });

  it('exporta múltiples filas en orden', () => {
    const csv = serializeSalesToCsv([
      saleFixture({ product_name: 'A' }),
      saleFixture({ product_name: 'B' }),
      saleFixture({ product_name: 'C' }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(4); // header + 3 filas
    expect(lines[1]!.startsWith('A,')).toBe(true);
    expect(lines[2]!.startsWith('B,')).toBe(true);
    expect(lines[3]!.startsWith('C,')).toBe(true);
  });

  it('escapa comas en valores (RFC 4180)', () => {
    const csv = serializeSalesToCsv([
      saleFixture({ product_name: 'Teclado, mouse y monitor' }),
    ]);
    const row = csv.slice(1).split('\r\n')[1]!;
    expect(row).toContain('"Teclado, mouse y monitor"');
  });

  it('escapa comillas dobles duplicándolas', () => {
    const csv = serializeSalesToCsv([
      saleFixture({ notes: 'El cliente dijo "hola"' }),
    ]);
    const row = csv.slice(1).split('\r\n')[1]!;
    expect(row).toContain('"El cliente dijo ""hola"""');
  });

  it('escapa saltos de línea en notas', () => {
    const csv = serializeSalesToCsv([
      saleFixture({ notes: 'Línea 1\nLínea 2' }),
    ]);
    const row = csv.slice(1).split('\r\n')[1]!;
    // El valor multilínea entero está envuelto en comillas (no se parte la fila).
    expect(row).toContain('"Línea 1\nLínea 2"');
  });

  it('importes van como entero sin formatear (céntimos literales)', () => {
    const csv = serializeSalesToCsv([saleFixture({ price_cents: 15000 })]);
    const row = csv.slice(1).split('\r\n')[1]!;
    expect(row).toContain(',15000,');
    expect(row).not.toContain('150.00');
    expect(row).not.toContain(',00 €');
  });

  it('lista vacía devuelve solo header + BOM', () => {
    const csv = serializeSalesToCsv([]);
    expect(csv).toBe('\ufeff' + CSV_HEADERS.join(','));
  });
});
