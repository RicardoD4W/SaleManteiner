/**
 * Primitivos Zod compartidos por la UI.
 * (Duplicado de server/src/schemas/common.ts. Refactor a shared/ queda como deuda.)
 */
import { z } from 'zod';

/** Cantidad monetaria en céntimos (entero no negativo). Brand evita mezclar con otros enteros. */
export const Cents = z.number().int().nonnegative().brand<'Cents'>();
export type Cents = z.infer<typeof Cents>;

/** Timestamp ISO 8601 en string. */
export const ISODateTime = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

/**
 * Día local sin hora ni zona. Formato `YYYY-MM-DD` estricto.
 * Se usa para `purchase_date` y para el form de `sold_at` (HTML5
 * `<input type="date">` produce este formato). El server exige ISO 8601
 * completo para `sold_at`, así que en el form convertimos
 * `YYYY-MM-DD` → `YYYY-MM-DDT00:00:00.000Z` antes de enviar.
 */
export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
export type LocalDate = z.infer<typeof LocalDate>;

/** Texto libre corto (nombres, categorías). */
export const ShortText = z.string().min(1).max(200);

/** Texto libre largo (notas). */
export const LongText = z.string().max(5000);

/** ID de fila en SQLite (entero positivo). */
export const RowId = z.number().int().positive().brand<'RowId'>();
export type RowId = z.infer<typeof RowId>;
