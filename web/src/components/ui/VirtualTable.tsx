import { useRef, type ReactNode } from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { tableHeadClass } from './tableStyles';

interface VirtualTableProps<TData> {
  table: Table<TData>;

  maxHeight?: string;

  estimateRowHeight?: number;

  footer?: ReactNode;
}

export function VirtualTable<TData>({
  table,
  maxHeight = '70vh',
  estimateRowHeight = 44,
  footer,
}: VirtualTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <table
          className="text-sm"
          style={{ display: 'grid', width: '100%', minWidth: table.getTotalSize() }}
          aria-rowcount={rows.length + 1}
        >
          <thead
            className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950"
            style={{ display: 'grid' }}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="flex w-full">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        flex: `${header.getSize()} 1 0`,
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      }}
                      className={`${tableHeadClass} text-left`}
                      aria-sort={
                        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                      }
                    >
                      <span className="flex items-center gap-1">
                        <span className="min-w-0 truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getCanSort() ? (
                          <span
                            className="inline-block w-3 shrink-0 text-center"
                            aria-hidden="true"
                          >
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody
            className="relative"
            style={{ display: 'grid', height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((vi) => {
              const row = rows[vi.index];
              return (
                <tr
                  key={row.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  aria-rowindex={vi.index + 2}
                  className="absolute flex w-full border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ flex: `${cell.column.getSize()} 1 0` }}
                      className="px-4 py-2 align-middle text-gray-800 dark:text-gray-200"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
