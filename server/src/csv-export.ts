/**
 * Serializer CSV (Fase 6 — exportación).
 *
 * Sin dependencias: helper puro que toma una lista de `Sale` y devuelve el
 * contenido CSV completo (UTF-8 con BOM al inicio, headers lowercase snake_case,
 * separador `,`, salto de línea `\r\n`). El resultado puede volcarse directo
 * a un Response en el endpoint.
 *
 * Roundtrip con la Fase 3 (importación):
 *  - Mismas columnas y mismo orden que las cabeceras que el `CreateSaleInput`
 *    del import espera. Garantiza que un export → edición en Excel → import
 *    preserva los datos sin tocarlos.
 *  - Encoding: UTF-8 con BOM (`\ufeff`) al inicio para que Excel-español abra
 *    acentos y ñ sin mostrar basura. Sheets/Numbers manejan BOM sin problema.
 *  - Escape RFC 4180: comillas dobles rodeando valores que contengan `,`,
 *    `"`, `\n` o `\r`. Las comillas internas se duplican.
 *  - Booleanos como `true`/`false` (string lowercase), fechas como están en BD
 *    (`purchase_date` `YYYY-MM-DD`, `sold_at` ISO 8601 con offset). Null → celda
 *    vacía.
 */
import type { Sale } from './schemas/sales.js';

/** Cabeceras del CSV en orden fijo (deben matchear CreateSaleInput en web/schemas/sales.ts). */
export const CSV_HEADERS = [
  'product_name',
  'buyer_name',
  'cost_cents',
  'price_cents',
  'associated_costs_cents',
  'sold',
  'purchase_date',
  'sold_at',
  'notes',
] as const;

/** Caracteres que fuerzan el escape RFC 4180. */
const CSV_ESCAPE_RE = /[",\n\r]/;

/** Devuelve el valor envuelto en comillas si necesita escape; si no, igual. */
function escapeCell(value: string): string {
  if (CSV_ESCAPE_RE.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializa una Sale a la fila CSV (sin BOM, sin headers). */
function rowForSale(s: Sale): string {
  const cells: string[] = [
    s.product_name,
    s.buyer_name ?? '',
    String(s.cost_cents),
    String(s.price_cents),
    String(s.associated_costs_cents),
    s.sold ? 'true' : 'false',
    s.purchase_date ?? '',
    s.sold_at ?? '',
    s.notes ?? '',
  ];
  return cells.map(escapeCell).join(',');
}

/**
 * Serializa una lista de ventas a un CSV completo.
 * Devuelve string UTF-8 (sin codificar todavía — el caller hace `res.send(...)`).
 * El output arranca con BOM `\ufeff` para compat con Excel-español.
 */
export function serializeSalesToCsv(sales: Sale[]): string {
  const headerLine = CSV_HEADERS.join(',');
  const body = sales.map(rowForSale);
  return '\ufeff' + [headerLine, ...body].join('\r\n');
}
