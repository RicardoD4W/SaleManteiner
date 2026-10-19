/**
 * Página de listado de ventas (S6 del feature).
 *
 * Tabla con TanStack Table:
 *  - Fecha, Cliente, Precio, Asociados, Beneficio (sale_price - associated -
 *    COGS - buy.assoc, prorrateado por unidad), Acciones.
 *
 * S3 del feature dashboard-iteration-1: el botón "+ Nueva venta" ahora
 * abre el `SaleNewModal` (multi-step con ProductPicker) en vez de
 * navegar a `/solds/new`. El endpoint `GET /api/solds` devuelve
 * `SoldWithProfit` para que la columna Beneficio muestre el dato real
 * calculado por el server (sin tener que cargar los items por venta).
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
import { useSolds } from '../../hooks/useSolds';
import { useCustomers } from '../../hooks/useCustomers';
import { Spinner } from '../../components/ui/Spinner';
import { SaleNewModal } from '../../components/sales/SaleNewModal';
import { formatDate, formatEuro } from '../../lib/format';
import type { SoldWithProfit } from '../../api/solds';

const columnHelper = createColumnHelper<SoldWithCustomer>();

/** Sold con nombre del cliente resuelto desde el cache. */
interface SoldWithCustomer extends SoldWithProfit {
  customerName: string;
}

export function SoldsListPage() {
  const { data: solds, isLoading, isError, error, refetch } = useSolds();
  const { data: customers } = useCustomers();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /** Un map de customerId → name para resolver nombres sin recorrer el array cada vez. */
  const customerMap = useMemo(() => {
    const map = new Map<number, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const soldsWithCustomer: SoldWithCustomer[] = useMemo(
    () =>
      (solds ?? []).map((s) => ({
        ...s,
        customerName: customerMap.get(s.customer_id) ?? `Cliente #${s.customer_id}`,
      })),
    [solds, customerMap],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('sold_at', {
        header: 'Fecha',
        cell: (info) => (
          <span className="text-gray-700 dark:text-gray-300">
            {formatDate(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.customerName, {
        id: 'customer',
        header: 'Cliente',
        cell: (info) => (
          <span className="text-gray-800 dark:text-gray-200">{info.getValue() as string}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('sale_price', {
        header: 'Precio (€)',
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
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
      // Beneficio calculado por el server (sale_price - associated_costs -
      // COGS_prorrateado - buy.associated_prorrateado, S13 del feature).
      // Positivo en emerald, negativo en rojo, cero en gris.
      columnHelper.accessor('profit', {
        header: 'Beneficio',
        cell: (info) => {
          const profit = info.getValue() as number;
          const colorClass =
            profit > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : profit < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400';
          return (
            <span className={`tabular-nums font-medium ${colorClass}`}>
              {formatEuro(profit)}
            </span>
          );
        },
        sortingFn: 'basic',
      }),
      columnHelper.accessor('created_at', {
        header: 'Registrado',
        cell: (info) => (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Link
            to={`/solds/${info.row.original.id}`}
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Editar
          </Link>
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table
  const table = useReactTable<SoldWithCustomer>({
    data: soldsWithCustomer,
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
        <Spinner size="sm" /> Cargando ventas…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <p>No se pudieron cargar las ventas: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!solds || solds.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ventas</h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
          >
            + Nueva venta
          </button>
        </div>
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">No hay ventas todavía.</p>
        </div>
        {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ventas</h2>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nueva venta
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
            Mostrando {table.getRowModel().rows.length} de {solds.length}
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
      {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}
    </div>
  );
}
