/**
 * Primitivos Zod compartidos por toda la app.
 * Principios aplicados (skill zod): schemas a nivel de módulo, exporta schema + tipo,
 * branded types para importes monetarios.
 */
import { z } from 'zod';

/** Cantidad monetaria en céntimos (entero no negativo). Brand evita mezclar con otros enteros. */
export const Cents = z.number().int().nonnegative().brand<'Cents'>();
export type Cents = z.infer<typeof Cents>;

/** Timestamp ISO 8601 en string. Validamos formato básico; la conversión a Date es opcional. */
export const ISODateTime = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

/**
 * Día local sin hora ni zona. Formato `YYYY-MM-DD` estricto (regex, no `z.coerce.date()`
 * porque eso aceptaría `Date` objects y rompería el contrato `string`).
 *
 * Uso típico: `purchase_date`. La invariante "fecha válida" se delega al navegador
 * al usar `<input type="date">` en el form, y a Zod acá si llega de otro origen (API).
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

/** ID de fila en SQLite (entero positivo). */
export const RowId = z.number().int().positive().brand<'RowId'>();
export type RowId = z.infer<typeof RowId>;