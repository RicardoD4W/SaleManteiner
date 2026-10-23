import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useSolds } from '../../hooks/useSolds';
import { useCustomers } from '../../hooks/useCustomers';
import { Spinner } from '../../components/ui/Spinner';
import { SearchInput } from '../../components/ui/SearchInput';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { SaleNewModal } from '../../components/sales/SaleNewModal';
import { DeleteDialogs, type DeleteTarget } from '../../components/sales/DeleteDialogs';
import { formatDate, formatEuro } from '../../lib/format';
import { filterSolds, type SoldWithCustomer } from '../../lib/searchQuery';
import type { SaleItemOutput } from '../../schemas/solds';
import type { Sold } from '../../schemas/solds';

const columnHelper = createColumnHelper<SoldWithCustomer>();

function transitionName(field: string, id: number): string {
  return `sold-${field}-${id}`;
}

function readArmedRow(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('armedRowId' in state)) return null;
  const valor = (state as { armedRowId?: unknown }).armedRowId;
  return typeof valor === 'number' ? valor : null;
}

interface ArmedRowContext {
  armedRowId: number | null;

  armRow: (row: SoldWithCustomer) => void;
}

const ArmedRowContext = createContext<ArmedRowContext>({
  armedRowId: null,
  armRow: () => {},
});

function TravellingCell({
  row,
  field,
  className,
  children,
}: {
  row: SoldWithCustomer;

  field: string;

  className?: string;
  children: ReactNode;
}) {
  const { armedRowId } = useContext(ArmedRowContext);
  const armed = row.id === armedRowId;
  const name = transitionName(field, row.id);
  return (
    <span
      className={['vt-cell', className ?? ''].join(' ')}
      style={armed ? { viewTransitionName: name } : undefined}
      data-vt-name={armed ? name : undefined}
    >
      {children}
    </span>
  );
}

function ActionsCell({
  row,
  onBorrar,
}: {
  row: SoldWithCustomer;
  onBorrar: (row: SoldWithCustomer) => void;
}) {
  const { armRow } = useContext(ArmedRowContext);
  return (
    <div className="flex items-center gap-3">
      <Link
        to={`/solds/${row.id}`}
        viewTransition
        onMouseEnter={() => armRow(row)}
        onFocus={() => armRow(row)}
        onPointerDown={() => armRow(row)}
        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={() => onBorrar(row)}
        aria-label={`Borrar venta #${row.id}`}
        className="cursor-pointer text-sm font-medium text-red-600 hover:underline dark:text-red-400"
      >
        Borrar
      </button>
    </div>
  );
}

export function SoldsListPage() {
  const { data: solds, isLoading, isError, error, refetch } = useSolds();
  const { data: customers } = useCustomers();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [query, setQuery] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [armed, setArmed] = useState<{ id: number; navigation: string } | null>(null);
  const location = useLocation();
  const queryClient = useQueryClient();

  const rowFromState = readArmedRow(location.state);

  const armedRowId = armed && armed.navigation === location.key ? armed.id : rowFromState;

  const armRow = useCallback(
    (sold: SoldWithCustomer) => {
      setArmed({ id: sold.id, navigation: location.key });
      queryClient.setQueryData<Sold>(['solds', sold.id], {
        id: sold.id,
        customer_id: sold.customer_id,
        sale_price: sold.sale_price,
        associated_costs: sold.associated_costs,
        sold_at: sold.sold_at,
        notes: sold.notes,
        created_at: sold.created_at,
      });
    },
    [location.key, queryClient],
  );

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

  const filteredSolds = useMemo(
    () => filterSolds(soldsWithCustomer, query),
    [soldsWithCustomer, query],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('sold_at', {
        header: 'Fecha',
        size: 115,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="date"
            className="whitespace-nowrap text-gray-700 dark:text-gray-300"
          >
            {formatDate(info.getValue())}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.customerName, {
        id: 'customer',
        header: 'Cliente',
        size: 140,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="client"
            className="text-gray-800 dark:text-gray-200"
          >
            {info.row.original.customerName}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.items, {
        id: 'items',
        header: 'Productos',
        size: 210,
        cell: (info) => {
          const items = info.getValue() as SaleItemOutput[];
          if (items.length === 0) {
            return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
          }
          return (
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li
                  key={item.buy_id}
                  className="flex w-full items-baseline gap-1.5 text-sm leading-tight"
                >
                  <span className="text-gray-800 w-[85%] dark:text-gray-200">
                    {item.product_name}
                  </span>
                  <span className="text-xs w-[15%]  text-gray-500 dark:text-gray-400">
                    × {item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          );
        },
        sortingFn: 'basic',
        enableSorting: false,
      }),
      columnHelper.accessor('sale_price', {
        header: 'Precio (€)',
        size: 115,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="price"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {formatEuro(info.getValue())}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs', {
        header: 'Asociados (€)',
        size: 140,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="associated"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {formatEuro(info.getValue())}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('profit', {
        header: 'Beneficio',
        size: 115,
        cell: (info) => {
          const profit = info.getValue() as number;
          const colorClass =
            profit > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : profit < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400';
          return (
            <span className={`tabular-nums font-medium ${colorClass}`}>{formatEuro(profit)}</span>
          );
        },
        sortingFn: 'basic',
      }),
      columnHelper.accessor('created_at', {
        header: 'Registrado',
        size: 120,
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            {formatDate(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        size: 130,
        cell: (info) => (
          <ActionsCell
            row={info.row.original}
            onBorrar={(row) => setDeleteTarget({ kind: 'sale', id: row.id })}
          />
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<SoldWithCustomer>({
    data: filteredSolds,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    table.setPageIndex(0);
  };

  const armedContextValue = useMemo<ArmedRowContext>(
    () => ({ armedRowId, armRow }),
    [armedRowId, armRow],
  );

  const resultsText =
    query.trim() === ''
      ? `${soldsWithCustomer.length} ${soldsWithCustomer.length === 1 ? 'venta' : 'ventas'}`
      : `${filteredSolds.length} de ${soldsWithCustomer.length} ${
          soldsWithCustomer.length === 1 ? 'venta' : 'ventas'
        }`;

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ventas</h2>
        <div className="flex w-full flex-col gap-1 sm:w-auto sm:max-w-xs sm:flex-1">
          <SearchInput
            value={query}
            resultsText={resultsText}
            countTestId="solds-search-count"
            onChange={handleQueryChange}
            label="Buscar ventas"
            landmarkLabel="Filtro de ventas"
            placeholder="Cliente, producto, precio, beneficio…"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nueva venta
        </button>
      </div>

      {filteredSolds.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sin resultados para «{query.trim()}»
          </p>
          <button
            type="button"
            onClick={() => handleQueryChange('')}
            className="mt-3 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-offset-gray-900"
          >
            Limpiar filtro
          </button>
        </div>
      ) : (
        <ArmedRowContext.Provider value={armedContextValue}>
          <VirtualTable
            table={table}
            footer={
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
                <span>
                  {filteredSolds.length === 1 ? '1 venta' : `${filteredSolds.length} ventas`}
                </span>
                {filteredSolds.length > 25 ? (
                  <span className="text-xs">Desplazate para ver el resto</span>
                ) : null}
              </div>
            }
          />
        </ArmedRowContext.Provider>
      )}
      {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}

      <DeleteDialogs target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
