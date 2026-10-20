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
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useBuys } from '../../hooks/useBuys';
import { Spinner } from '../../components/ui/Spinner';
import { SearchInput } from '../../components/ui/SearchInput';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { BuyNewModal } from '../../components/sales/BuyNewModal';
import { formatDate, formatEuro } from '../../lib/format';
import { filterBuys } from '../../lib/searchQuery';
import type { BuyWithStock } from '../../api/buys';

const columnHelper = createColumnHelper<BuyWithStock>();

export function BuysListPage() {
  const { data, isLoading, isError, error, refetch } = useBuys();
  // Sin sort por defecto: el user pide explícitamente el estado idle (ni asc ni desc).
  // El server ya devuelve los buys en id DESC, así que sin sort se ve lo más nuevo arriba.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  /** Query del buscador (client-side). */
  const [query, setQuery] = useState('');

  // `useBuys` ya devuelve `BuyWithStock[]` con los disponibles calculados por
  // el server (`listWithStock` en el repo). No hay transformación cliente.
  // Va en useMemo para que el array no cambie de identidad en cada render
  // (si no, los useMemo de abajo se recalculan siempre).
  const buysWithStock = useMemo<BuyWithStock[]>(() => data ?? [], [data]);

  /**
   * Filtro client-side por la query del buscador. Se aplica ANTES de la
   * tabla (TanStack Table pagina sobre las filas ya filtradas).
   */
  const filteredBuys = useMemo(() => filterBuys(buysWithStock, query), [buysWithStock, query]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('product_name', {
        header: 'Producto',
        size: 260,
        // El nombre NO es link — el user pidió que no se pueda editar
        // haciendo click en el nombre. La edición sigue disponible vía
        // la columna "Acciones" → "Editar".
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        sortingFn: 'basic',
      }),
      columnHelper.accessor('purchase_cost', {
        header: 'Coste (€)',
        size: 120,
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('quantity', {
        header: 'Cantidad',
        size: 110,
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">{info.getValue()}</span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs', {
        header: 'Asociados (€)',
        size: 130,
        cell: (info) => (
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('purchase_date', {
        header: 'Fecha compra',
        size: 150,
        cell: (info) => (
          <span className="whitespace-nowrap text-gray-700 dark:text-gray-300">
            {formatDate(info.getValue())}
          </span>
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
        size: 90,
        cell: (info) => (
          <Link
            to={`/buys/${info.row.original.id}`}
            // viewTransition (RR 7+) usa la View Transitions API del browser
            // para animar la navegación /buys → /buys/:id. Default = cross-fade.
            // Degrada a instantáneo en navegadores sin soporte (Safari < 18, Firefox < 134).
            viewTransition
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
    data: filteredBuys,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  /**
   * Cambia la query del buscador. La tabla es virtualizada (scroll infinito),
   * así que no hay páginas que resetear: el filtro se aplica sobre todas las
   * filas y la vista se posiciona arriba sola al cambiar la query.
   */
  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  /** Texto del contador de resultados. */
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
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nueva compra
        </button>
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
      )}
      {isModalOpen ? <BuyNewModal onClose={() => setIsModalOpen(false)} /> : null}
    </div>
  );
}
