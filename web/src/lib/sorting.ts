export type SortDir = 'asc' | 'desc' | null;

export type SortState = 'asc' | 'desc' | false;

/**
 * La regla de comparación de TODAS las tablas: los nulos primero, los números
 * como números y los textos en español (con los dígitos en su lugar: "Funda 2"
 * antes que "Funda 10").
 *
 * Vive acá y no en cada tabla para que ordenar por la misma columna dé el mismo
 * resultado en cualquier pantalla.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true });
}

interface RowWithValue {
  getValue: (columnId: string) => unknown;
}

/**
 * El mismo comparador, con la firma que espera TanStack Table (recibe las
 * filas y el id de la columna, no los valores).
 */
export function compareRows(a: RowWithValue, b: RowWithValue, columnId: string): number {
  return compareValues(a.getValue(columnId), b.getValue(columnId));
}
