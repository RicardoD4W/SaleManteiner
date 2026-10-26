import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useSolds } from '../../hooks/useSolds';
import { useSortable } from '../../hooks/useSortable';
import { useCustomers } from '../../hooks/useCustomers';
import { Spinner } from '../../components/ui/Spinner';
import { SearchInput } from '../../components/ui/SearchInput';
import { VirtualTable } from '../../components/ui/VirtualTable';
import {
  ArmedRowProvider,
  RowActions,
  TravellingCell,
  useArmedRow,
} from '../../components/ui/armedRow';
import { SaleNewModal } from '../../components/sales/SaleNewModal';
import { DeleteDialogs, type DeleteTarget } from '../../components/sales/DeleteDialogs';
import { formatDate, formatEuro } from '../../lib/format';
import { filterSolds, type SoldWithCustomer } from '../../lib/searchQuery';
import type { SaleItemOutput } from '../../schemas/solds';
import type { SoldWithItems } from '../../schemas/solds';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../../components/ui/tableStyles';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';

const columnHelper = createColumnHelper<SoldRow>();

function toSoldDetail(sold: SoldWithCustomer): SoldWithItems {
  return {
    id: sold.id,
    customer_id: sold.customer_id,
    sale_price: sold.sale_price,
    associated_costs: sold.associated_costs,
    sold_at: sold.sold_at,
    notes: sold.notes,
    created_at: sold.created_at,
    customer_name: sold.customerName,
    items: sold.items,
  };
}

interface SoldRow extends SoldWithCustomer {
  firstProduct: string;
}

export function SoldsListPage() {
  const { data: solds, isLoading, isError, error, refetch } = useSolds();
  const { data: customers } = useCustomers();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [query, setQuery] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { contextValue } = useArmedRow({
    transitionPrefix: 'sold',
    detailKey: 'solds',
    toDetail: toSoldDetail,
  });

  const customerMap = useMemo(() => {
    const map = new Map<number, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const soldsWithCustomer: SoldRow[] = useMemo(
    () =>
      (solds ?? []).map((s) => ({
        ...s,
        customerName: customerMap.get(s.customer_id) ?? `Cliente #${s.customer_id}`,
        firstProduct: s.items[0]?.product_name ?? '',
      })),
    [solds, customerMap],
  );

  const filteredSolds = useMemo(
    () => filterSolds(soldsWithCustomer, query),
    [soldsWithCustomer, query],
  );

  const { sortedItems, sortKey, sortDir, onSort } = useSortable(filteredSolds);

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
      }),
      columnHelper.accessor('customerName', {
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
      }),
      columnHelper.accessor('firstProduct', {
        id: 'firstProduct',
        header: 'Productos',
        size: 210,
        cell: (info) => {
          const items = info.row.original.items as SaleItemOutput[];
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
      }),
      columnHelper.accessor('profit', {
        header: 'Beneficio',
        size: 115,
        cell: (info) => {
          const profit = info.getValue() as number;
          const colorClass =
            profit > 0
              ? 'text-emerald-800 dark:text-emerald-300'
              : profit < 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400';
          return (
            <span className={`tabular-nums font-medium ${colorClass}`}>{formatEuro(profit)}</span>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Registrado',
        size: 120,
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        size: 130,
        cell: (info) => (
          <RowActions
            row={info.row.original}
            editBasePath="/solds"
            deleteAriaLabel={`Borrar venta #${info.row.original.id}`}
            onDelete={(row) => setDeleteTarget({ kind: 'sale', id: row.id })}
          />
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<SoldRow>({
    data: sortedItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    table.setPageIndex(0);
  };

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
      <div className={cn(errorAlertClass, 'p-4')}>
        <ErrorState
          message={`No se pudieron cargar las ventas: ${error.message}`}
          onRetry={() => refetch()}
          messageClassName=""
        />
      </div>
    );
  }

  if (!solds || solds.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ventas</h2>
          <Button onClick={() => setIsModalOpen(true)}>+ Nueva venta</Button>
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
        <Button onClick={() => setIsModalOpen(true)}>+ Nueva venta</Button>
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
        <ArmedRowProvider value={contextValue}>
          <VirtualTable
            table={table}
            sort={{
              columnId: sortKey,
              direction: sortDir,
              onSort: (columnId) => onSort(columnId as keyof SoldRow),
            }}
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
        </ArmedRowProvider>
      )}
      {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}

      <DeleteDialogs target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
