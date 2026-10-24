import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useBuys } from '../../hooks/useBuys';
import { Spinner } from '../../components/ui/Spinner';
import { SearchInput } from '../../components/ui/SearchInput';
import { VirtualTable } from '../../components/ui/VirtualTable';
import {
  ArmedRowProvider,
  RowActions,
  TravellingCell,
  useArmedRow,
} from '../../components/ui/armedRow';
import { BuyNewModal } from '../../components/sales/BuyNewModal';
import { DeleteDialogs, type DeleteTarget } from '../../components/sales/DeleteDialogs';
import { formatDate, formatEuro } from '../../lib/format';
import { filterBuys } from '../../lib/searchQuery';
import type { BuyWithStock } from '../../api/buys';
import type { Buy } from '../../schemas/buys';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../../components/ui/tableStyles';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';

const columnHelper = createColumnHelper<BuyWithStock>();

function toBuyDetail(buy: BuyWithStock): Buy {
  return {
    id: buy.id,
    product_name: buy.product_name,
    purchase_cost: buy.purchase_cost,
    quantity: buy.quantity,
    associated_costs: buy.associated_costs,
    purchase_date: buy.purchase_date,
    created_at: buy.created_at,
  };
}

export function BuysListPage() {
  const { data, isLoading, isError, error, refetch } = useBuys();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [query, setQuery] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { contextValue } = useArmedRow({
    transitionPrefix: 'buy',
    detailKey: 'buys',
    toDetail: toBuyDetail,
  });

  const buysWithStock = useMemo<BuyWithStock[]>(() => data ?? [], [data]);

  const filteredBuys = useMemo(() => filterBuys(buysWithStock, query), [buysWithStock, query]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('product_name', {
        header: 'Producto',
        size: 220,
        cell: (info) => (
          <TravellingCell row={info.row.original} field="product" className="font-medium">
            {info.row.original.product_name}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('purchase_cost', {
        header: 'Coste (€)',
        size: 120,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="cost"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {formatEuro(info.getValue())}
          </TravellingCell>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('quantity', {
        header: 'Cantidad',
        size: 110,
        cell: (info) => (
          <TravellingCell
            row={info.row.original}
            field="qty"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {info.getValue()}
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
      columnHelper.accessor('purchase_date', {
        header: 'Fecha compra',
        size: 150,
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
      columnHelper.accessor((row) => row.disponibles, {
        id: 'disponibles',
        header: 'Disponibles',
        size: 130,
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
        size: 140,
        cell: (info) => (
          <RowActions
            row={info.row.original}
            editBasePath="/buys"
            deleteAriaLabel={`Borrar ${info.row.original.product_name}`}
            onDelete={(row) => setDeleteTarget({ kind: 'buy', id: row.id, name: row.product_name })}
          />
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<BuyWithStock>({
    data: filteredBuys,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  const resultsText =
    query.trim() === ''
      ? `${buysWithStock.length} ${buysWithStock.length === 1 ? 'compra' : 'compras'}`
      : `${filteredBuys.length} de ${buysWithStock.length} ${
          buysWithStock.length === 1 ? 'compra' : 'compras'
        }`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando compras…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn(errorAlertClass, 'p-4')}>
        <ErrorState
          message={`No se pudieron cargar las compras: ${error.message}`}
          onRetry={() => refetch()}
          messageClassName=""
        />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Compras</h2>
          <Button onClick={() => setIsModalOpen(true)}>+ Nueva compra</Button>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Compras</h2>
        <div className="flex w-full flex-col gap-1 sm:w-auto sm:max-w-xs sm:flex-1">
          <SearchInput
            value={query}
            resultsText={resultsText}
            countTestId="buys-search-count"
            onChange={handleQueryChange}
            label="Buscar compras"
            landmarkLabel="Filtro de compras"
            placeholder="Producto, coste, cantidad, fecha…"
          />
        </div>
        <Button onClick={() => setIsModalOpen(true)}>+ Nueva compra</Button>
      </div>

      {filteredBuys.length === 0 ? (
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
            footer={
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
                <span>
                  {filteredBuys.length === 1 ? '1 compra' : `${filteredBuys.length} compras`}
                </span>
                {filteredBuys.length > 25 ? (
                  <span className="text-xs">Desplazate para ver el resto</span>
                ) : null}
              </div>
            }
          />
        </ArmedRowProvider>
      )}
      {isModalOpen ? <BuyNewModal onClose={() => setIsModalOpen(false)} /> : null}

      <DeleteDialogs target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
