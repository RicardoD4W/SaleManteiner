/**
 * Página de listado de compras (S4 del feature).
 *
 * Tabla con TanStack Table:
 *  - Producto, Coste, Cantidad, Asociados, Fecha compra, Disponibles, Acciones.
 *  - Disponibles = quantity - SUM(sale_items.quantity).
 *  - Acciones → enlace a /buys/:id (editar).
 *
 *  S3 del feature dashboard-iteration-1: el botón "+ Nueva compra" ahora
 *  abre el `BuyNewModal` en vez de navegar a `/buys/new`.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useBuys } from '../../hooks/useBuys';
import { Spinner } from '../../components/ui/Spinner';
import { BuyNewModal } from '../../components/sales/BuyNewModal';
import { formatDate, formatEuro } from '../../lib/format';
import type { Buy } from '../../schemas/buys';

const columnHelper = createColumnHelper<BuyWithStock>();

interface BuyWithStock extends Buy {
  /** Disponibles para vender: quantity - SUM(sale_items.quantity). */
  disponibles: number;
}

export function BuysListPage() {
  const { data, isLoading, isError, error, refetch } = useBuys();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // TODO (T12 del feature): el server devolverá stock en una query separada
  // (`GET /api/buys` con left join a sale_items). Por ahora mostramos quantity.
  // Las filas tienen disponible=buy.quantity (sin restar ventas).
  const buysWithStock: BuyWithStock[] = useMemo(
    () =>
      (data ?? []).map((b) => ({
        ...b,
        disponibles: b.quantity, // Placeholder hasta T12
      })),
    [data],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('product_name', {
        header: 'Producto',
        cell: (info) => (
          <Link
            to={`/buys/${info.row.original.id}`}
            className="font-medium text-brand-700 dark:text-brand-400 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('purchase_cost', {
        header: 'Coste (€)',
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('quantity', {
        header: 'Cantidad',
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {info.getValue()}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs', {
        header: 'Asociados (€)',
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('purchase_date', {
        header: 'Fecha compra',
        cell: (info) => (
          <span className="text-gray-700 dark:text-gray-300">{formatDate(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.disponibles, {
        id: 'disponibles',
        header: 'Disponibles',
        cell: (info) => {
          const disponibles = info.getValue() as number;
          return (
            <span
              className={[
                'tabular-nums font-medium',
                disponibles === 0
                  ? 'text-gray-400 dark:text-gray-500'
                  : disponibles <= 2
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-700 dark:text-gray-300',
              ].join(' ')}
            >
              {disponibles}
            </span>
          );
        },
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Link
            to={`/buys/${info.row.original.id}`}
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Editar
          </Link>
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table devuelve fns no memoizables; la tabla es chica, el perf no es problema
  const table = useReactTable<BuyWithStock>({
    data: buysWithStock as BuyWithStock[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando compras…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <p>No se pudieron cargar las compras: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Compras</h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
          >
            + Nueva compra
          </button>
        </div>
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">No hay compras todavía.</p>
        </div>
        {isModalOpen ? <BuyNewModal onClose={() => setIsModalOpen(false)} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Compras</h2>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nueva compra
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ▲' : null}
                      {header.column.getIsSorted() === 'desc' ? ' ▼' : null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 align-middle text-gray-800 dark:text-gray-200"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
          <span>
            Mostrando {table.getRowModel().rows.length} de {data.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              ← Anterior
            </button>
            <span className="px-2 py-1">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
      {isModalOpen ? <BuyNewModal onClose={() => setIsModalOpen(false)} /> : null}
    </div>
  );
}
