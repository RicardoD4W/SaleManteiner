export type SortDir = 'asc' | 'desc' | null;

export type SortState = 'asc' | 'desc' | false;

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

export function compareRows(a: RowWithValue, b: RowWithValue, columnId: string): number {
  return compareValues(a.getValue(columnId), b.getValue(columnId));
}
