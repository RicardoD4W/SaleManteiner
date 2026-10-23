import { tableHeadClass } from './tableStyles';
import type { SortDir } from '../../hooks/useSortable';

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
  const indicator = isActive ? (currentDir === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSort(sortKey);
        }
      }}
      tabIndex={0}
      className={`cursor-pointer ${tableHeadClass} text-left focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:focus-visible:ring-brand-400`}
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="whitespace-nowrap">{label}</span>

      <span className="ml-1 inline-block w-3">{indicator}</span>
    </th>
  );
}
