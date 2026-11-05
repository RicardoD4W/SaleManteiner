import { SortableTh } from './SortableTh';
import { tableHeadClass } from './tableStyles';
import type { SortDir } from '../../lib/sorting';

interface SortableTableHeadProps<T> {
  label: string;
  sortKey: keyof T & string;
  currentKey: keyof T | null;
  currentDir: SortDir;
  onSort: (key: keyof T & string) => void;
  align?: 'left' | 'right';
}

export function SortableTableHead<T>({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = 'left',
}: SortableTableHeadProps<T>) {
  const isActive = currentKey === sortKey;
  return (
    <SortableTh
      label={label}
      sorted={isActive ? (currentDir === 'asc' ? 'asc' : 'desc') : false}
      onSort={() => onSort(sortKey)}
      className={[
        tableHeadClass,
        'cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:focus-visible:ring-brand-400',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
      labelClassName="whitespace-nowrap"
      contentClassName={align === 'right' ? 'justify-end' : undefined}
    />
  );
}
