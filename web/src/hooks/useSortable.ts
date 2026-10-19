/**
 * Hook reutilizable para tablas con sort de 3 estados (S8 del feature
 * dashboard-iteration-1).
 *
 * Patrón:
 *  - Click en una columna distinta a la actual → arranca en `'asc'`.
 *  - Click en la misma columna cicla: `null → 'asc' → 'desc' → null`.
 *  - Solo una columna a la vez.
 *  - Si `sortDir === null`, `sortedItems` devuelve el array original (no se
 *    ordena), preservando el orden de la fuente.
 *
 * Uso:
 * ```tsx
 * const { sortedItems, sortKey, sortDir, onSort } = useSortable(rows);
 * // ...
 * <th onClick={() => onSort('product_name')}>
 *   Producto {sortKey === 'product_name' && (sortDir === 'asc' ? '▲' : '▼')}
 * </th>
 * ```
 *
 * El comparador usa `<` / `>` de JS (orden natural). Para strings usa locale
 * comparison; para números compara como números. Mezclar tipos dentro de la
 * misma columna no está soportado.
 */
import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc' | null;

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'es', { numeric: true });
}

export function useSortable<T>(
  items: T[],
  defaultKey?: keyof T,
): {
  sortedItems: T[];
  sortKey: keyof T | null;
  sortDir: SortDir;
  onSort: (key: keyof T) => void;
} {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultKey ? 'asc' : null);

  const onSort = useCallback(
    (key: keyof T) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
        return;
      }
      // Misma columna: cicla null → asc → desc → null.
      if (sortDir === null) {
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortDir(null);
        setSortKey(null);
      }
    },
    [sortKey, sortDir],
  );

  const sortedItems = useMemo(() => {
    if (sortKey === null || sortDir === null) return items;
    const next = [...items].sort((a, b) => {
      const cmp = compare(a[sortKey], b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return next;
  }, [items, sortKey, sortDir]);

  return { sortedItems, sortKey, sortDir, onSort };
}
