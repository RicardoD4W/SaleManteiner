/**
 * Primitivos Zod compartidos por la UI.
 * Mirror del server/src/schemas/common.ts. Refactor a shared/ queda como deuda.
 *
 * NOTA: branded types `Cents`/`RowId` se eliminan en feature-buys-and-solds.
 * El nuevo modelo usa euros decimales sin marca + helper round2() (S2 del feature).
 */
import { z } from 'zod';

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
