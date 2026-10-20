/**
 * Tabla virtualizada (scroll infinito) sobre TanStack Table.
 *
 * Qué resuelve: con 2.000+ filas, renderizar todo en el DOM costaba un
 * long task de 675 ms y 30.058 nodos (medido con Playwright + CDP). Con el
 * virtualizador solo existen en el DOM las filas visibles (~25) + un pequeño
 * `overscan`, así que el coste es constante por más filas que haya.
 *
 * Patrón: el de la guía oficial de TanStack (`@tanstack/react-virtual` +
 * `react-table` v8). El `<table>` y el `<tbody>` son `display: grid` y las
 * filas son `display: flex` posicionadas en absoluto: eso permite que las
 * celdas tengan ancho fijo (columnas estables al scrollear) y que el alto
 * real de cada fila se mida (`measureElement`), importante porque la celda
 * "Productos" de /solds tiene varias líneas.
 *
 * Accesibilidad: la tabla expone `aria-rowcount` (cuántas filas hay en
 * total) y cada fila `aria-rowindex` (su posición real), que es la técnica
 * estándar para tablas virtualizadas: los lectores de pantalla saben que
 * hay más filas de las que ven en el DOM.
 */
import { useRef, type ReactNode } from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { tableHeadClass } from './tableStyles';

interface VirtualTableProps<TData> {
  /** Instancia de TanStack Table (ya filtrada y ordenada). */
  table: Table<TData>;
  /** Alto máximo del área con scroll. */
  maxHeight?: string;
  /** Altura estimada de una fila en px (se ajusta con la medición real). */
  estimateRowHeight?: number;
  /** Contenido del pie de la tabla (conteos, avisos). */
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

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual devuelve fns no memoizables (igual que TanStack Table); el coste es constante porque solo se renderizan las filas visibles
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    // Filas extra renderizadas por encima y por debajo de la ventana: evita
    // flashes al hacer scroll rápido.
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <table
          className="text-sm"
          style={{ display: 'grid', width: '100%', minWidth: table.getTotalSize() }}
          // Cuántas filas tiene la tabla de verdad (incluye la del header).
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
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? ' ▲' : null}
                        {sorted === 'desc' ? ' ▼' : null}
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
                  // Necesario para que el virtualizador mida el alto real de
                  // la fila (la celda "Productos" puede ocupar varias líneas).
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  // Posición real de la fila dentro de la tabla completa.
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
