import { useCallback, useMemo, useState } from 'react';
import { compareValues, type SortDir } from '../lib/sorting';

export type { SortDir } from '../lib/sorting';

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
      const cmp = compareValues(a[sortKey], b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return next;
  }, [items, sortKey, sortDir]);

  return { sortedItems, sortKey, sortDir, onSort };
}
