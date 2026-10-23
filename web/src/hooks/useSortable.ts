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
