/**
 * Primitivos Zod compartidos por toda la app.
 * Principios aplicados (skill zod): schemas a nivel de módulo, exporta schema + tipo.
 *
 * NOTA sobre branded types legacy (Cents/RowId): se eliminan en feature-buys-and-solds.
 * El nuevo modelo usa euros decimales sin marca + helper round2() (S2 del feature).
 */
import { z } from 'zod';

/** Timestamp ISO 8601 en string. Validamos formato básico; la conversión a Date es opcional. */
export const ISODateTime = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

/**
 * Día local sin hora ni zona. Formato `YYYY-MM-DD` estricto (regex, no `z.coerce.date()`
 * porque eso aceptaría `Date` objects y rompería el contrato `string`).
 *
 * Uso típico: `purchase_date`, `sold_at`. La invariante "fecha válida" se delega al
 * navegador al usar `<input type="date">` en el form, y a Zod acá si llega de otro
 * origen (API).
 */
export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
export type LocalDate = z.infer<typeof LocalDate>;

/** URL válida (http/https). */
export const Url = z.string().url().max(2048);
export type Url = z.infer<typeof Url>;

/** Texto libre corto (nombres, categorías). */
export const ShortText = z.string().min(1).max(200);

/** Texto libre largo (notas). */
export const LongText = z.string().max(5000);

/**
 * Importe monetario en euros decimales (REAL de SQLite).
 * Validación: número no negativo, múltiplo de 0.01 (máximo 2 decimales).
 * Helper round2() mitiga el error IEEE 754 en operaciones en cadena (S2 del feature).
 */
export const EuroMoney = z.number().nonnegative().multipleOf(0.01);
export type EuroMoney = z.infer<typeof EuroMoney>;

/** ID de fila en SQLite (entero positivo). Sin marca (feature-buys-and-solds elimina Cents/RowId). */
export const RowId = z.number().int().positive();
export type RowId = z.infer<typeof RowId>;
