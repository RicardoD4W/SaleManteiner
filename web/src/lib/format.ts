/**
 * Formatters: moneda y fecha en formato español.
 * Importante: la app almacena importes en céntimos (entero).
 * El usuario ve euros con 2 decimales. Conversión: cents / 100.
 */

const eurFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Convierte céntimos a string EUR formateado: 1250 → "12,50 €". */
export function formatCents(cents: number): string {
  return eurFormatter.format(cents / 100);
}

/** Convierte euros (decimal) a string EUR formateado: 12.50 → "12,50 €". */
export function formatEuro(euros: number): string {
  return eurFormatter.format(euros);
}

/** Convierte céntimos a número en euros (para inputs): 1250 → 12.5. */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** Convierte euros a céntimos: 12.5 → 1250 (entero, redondeo para evitar floats sucios). */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** ISO 8601 → "16/10/2026" (dd/MM/yyyy). `null` → "—". */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return dateFormatter.format(new Date(iso));
}

/** ISO 8601 → "16/10/2026, 22:34" (dd/MM/yyyy HH:mm). */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Día actual local en formato `YYYY-MM-DD` (lo que produce `<input type="date">`). */
export function todayLocalDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Convierte un día `YYYY-MM-DD` (formato del form) a ISO 8601 UTC midnight.
 * El server exige ISO con offset para `sold_at`; usamos `T00:00:00.000Z`
 * como convención fija — la hora exacta no interesa al usuario, solo el día.
 */
export function localDateToISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

/**
 * Extrae la parte de día `YYYY-MM-DD` de un ISO 8601, usando componentes UTC.
 * Es la inversa de `localDateToISO` y se usa para rellenar el `<input type="date">`
 * al editar una venta.
 */
export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
