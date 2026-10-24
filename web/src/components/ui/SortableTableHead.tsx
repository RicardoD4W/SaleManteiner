import { SortableTh } from './SortableTh';
import { tableHeadClass } from './tableStyles';
import type { SortDir } from '../../lib/sorting';

interface SortableTableHeadProps<T> {
  label: string;
  sortKey: keyof T & string;
  currentKey: keyof T | null;
  currentDir: SortDir;
  onSort: (key: keyof T & string) => void;
}

export function SortableTableHead<T>({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: SortableTableHeadProps<T>) {
  const isActive = currentKey === sortKey;
  return (
    <SortableTh
      label={label}
      sorted={isActive ? (currentDir === 'asc' ? 'asc' : 'desc') : false}
      onSort={() => onSort(sortKey)}
      className={`${tableHeadClass} cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:focus-visible:ring-brand-400`}
      labelClassName="whitespace-nowrap"
    />
  );
}
