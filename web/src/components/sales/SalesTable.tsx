import { useMemo } from 'react';
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
import { useState } from 'react';
import { useSales } from '../../hooks/useSales';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { formatCents, formatDate } from '../../lib/format';
import type { Sale } from '../../schemas/sales';

const columnHelper = createColumnHelper<Sale>();

export function SalesTable() {
  const { data, isLoading, isError, error, refetch } = useSales();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('product_name', {
        header: 'Producto',
        cell: (info) => (
          <Link
            to={`/sales/${info.row.original.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('buyer_name', {
        header: 'Comprador',
        cell: (info) => info.getValue() ?? <span className="text-gray-400">—</span>,
      }),
      columnHelper.accessor('cost_cents', {
        header: 'Coste',
        cell: (info) => (
          <span className="tabular-nums text-gray-700">{formatCents(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('price_cents', {
        header: 'Precio',
        cell: (info) => (
          <span className="tabular-nums text-gray-700">{formatCents(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs_cents', {
        header: 'Costes asoc.',
        cell: (info) => (
          <span className="tabular-nums text-gray-700">{formatCents(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('purchase_date', {
        header: 'Compra',
        // `formatDate(null)` devuelve "—"; los strings YYYY-MM-DD ordenan lexicográficamente bien.
        cell: (info) => (
          <span className="text-gray-700">{formatDate(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('sold', {
        header: 'Vendido',
        cell: (info) =>
          info.getValue() ? <Badge variant="success">Sí</Badge> : <Badge>No</Badge>,
        sortingFn: 'basic',
      }),
      columnHelper.accessor('sold_at', {
        header: 'Venta',
        // `formatDate(null)` devuelve "—"; los ISO ordenan lexicográficamente bien.
        cell: (info) => (
          <span className="text-gray-700">{formatDate(info.getValue())}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Link
            to={`/sales/${info.row.original.id}`}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Editar
          </Link>
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table devuelve fns no memoizables; la tabla es chica, el perf no es problema
  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Spinner size="sm" /> Cargando ventas…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>No se pudieron cargar las ventas: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm text-gray-600">No hay ventas todavía.</p>
        <Link
          to="/sales/new"
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          Crear la primera →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left font-medium text-gray-700"
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
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 align-middle text-gray-800">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm text-gray-600">
        <span>
          Mostrando {table.getRowModel().rows.length} de {data.length}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="px-2 py-1">
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
