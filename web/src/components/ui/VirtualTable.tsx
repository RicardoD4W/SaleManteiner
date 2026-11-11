import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { tableHeadClass, columnAlign, columnMetaOf } from './tableStyles';
import { SortableTh } from './SortableTh';
import { cn } from '../../lib/classNames';
import type { SortDir } from '../../lib/sorting';

interface VirtualTableProps<TData> {
  table: Table<TData>;

  maxHeight?: string;

  estimateRowHeight?: number;

  footer?: ReactNode;

  sort?: {
    columnId: string | null;

    direction: SortDir;

    onSort: (columnId: string) => void;
  };

  getRowClassName?: (row: TData) => string | undefined;

  getRowKey?: (row: TData) => string;

  getRowStyle?: (row: TData) => CSSProperties | undefined;
}

export function VirtualTable<TData>({
  table,
  maxHeight = '70vh',
  estimateRowHeight = 44,
  footer,
  sort,
  getRowClassName,
  getRowKey,
  getRowStyle,
}: VirtualTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const rows = table.getRowModel().rows;

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const measureHeader = useCallback(() => {
    const headerCells = headerRowRef.current?.children;
    if (!headerCells || headerCells.length === 0) return;
    const widths = Array.from(headerCells).map((cell) => cell.getBoundingClientRect().width);
    setColumnWidths((previous) =>
      previous.length === widths.length &&
      previous.every((width, index) => Math.abs(width - widths[index]) < 0.5)
        ? previous
        : widths,
    );
  }, []);

  useLayoutEffect(() => {
    measureHeader();
  }, [measureHeader, table, rows.length]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureHeader());
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureHeader]);

  const cellFlex = useCallback(
    (index: number, size: number) => {
      const width = columnWidths[index];
      return width ? `0 0 ${width}px` : `${size} 1 0`;
    },
    [columnWidths],
  );

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
              <tr key={hg.id} ref={headerRowRef} className="flex w-full">
                {hg.headers.map((header) => {
                  const sorted = sort?.columnId === header.column.id ? sort.direction : null;
                  const label = flexRender(header.column.columnDef.header, header.getContext());
                  const align = columnAlign(columnMetaOf(header.column.columnDef.meta).align);
                  const style = {
                    flex: `${header.getSize()} 1 0`,
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                  };
                  if (!header.column.getCanSort()) {
                    return (
                      <th key={header.id} style={style} className={`${tableHeadClass} ${align}`}>
                        {label}
                      </th>
                    );
                  }
                  return (
                    <SortableTh
                      key={header.id}
                      label={label}
                      sorted={sorted === 'asc' ? 'asc' : sorted === 'desc' ? 'desc' : false}
                      onSort={() => sort?.onSort(header.column.id)}
                      className={`${tableHeadClass} ${align}`}
                      contentClassName={align === 'text-center' ? 'justify-center' : undefined}
                      style={style}
                    />
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
              const rowClassName = getRowClassName?.(row.original);
              const rowStyle = getRowStyle?.(row.original);
              return (
                <tr
                  key={getRowKey?.(row.original) ?? row.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  aria-rowindex={vi.index + 2}
                  className={`absolute flex w-full border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800${
                    rowClassName ? ` ${rowClassName}` : ''
                  }`}
                  style={{ ...rowStyle, transform: `translateY(${vi.start}px)` }}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const meta = columnMetaOf(cell.column.columnDef.meta);
                    return (
                      <td
                        key={cell.id}
                        style={{ flex: cellFlex(index, cell.column.getSize()) }}
                        className={cn(
                          'py-2 align-middle text-gray-800 dark:text-gray-200',
                          meta.compact ? 'px-2' : 'px-4',
                          columnAlign(meta.align) === 'text-center' && 'text-center',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
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
