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
import { formatDate, formatEuro } from '../../lib/format';
import { filterSolds, type SoldWithCustomer } from '../../lib/searchQuery';
import type { SaleItemOutput } from '../../schemas/solds';

const columnHelper = createColumnHelper<SoldWithCustomer>();

export function SoldsListPage() {
  const { data: solds, isLoading, isError, error, refetch } = useSolds();
  const { data: customers } = useCustomers();
  // Sin sort por defecto: el user pide explícitamente el estado idle (ni asc ni desc).
  // El server ya devuelve las solds en id DESC, así que sin sort se ve
  // lo más nuevo arriba.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  /** Query del buscador (client-side). */
  const [query, setQuery] = useState('');

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

  /**
   * Filtro client-side por la query del buscador. Se aplica ANTES de la
   * tabla (TanStack Table pagina sobre las filas ya filtradas).
   */
  const filteredSolds = useMemo(
    () => filterSolds(soldsWithCustomer, query),
    [soldsWithCustomer, query],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('sold_at', {
        header: 'Fecha',
        size: 120,
        cell: (info) => (
          <span className="whitespace-nowrap text-gray-700 dark:text-gray-300">
            {formatDate(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.customerName, {
        id: 'customer',
        header: 'Cliente',
        size: 150,
        cell: (info) => (
          <span className="text-gray-800 dark:text-gray-200">{info.getValue() as string}</span>
        ),
        sortingFn: 'basic',
      }),
      // Productos vendidos (S de UI: mostrar en la lista qué se vendió
      // y cuántas unidades, sin abrir el detalle). Una línea por item
      // del pack; cada línea con el formato "nombre × cantidad".
      columnHelper.accessor((row) => row.items, {
        id: 'items',
        header: 'Productos',
        size: 230,
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
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatEuro(info.getValue())}
          </span>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs', {
        header: 'Asociados (€)',
        // Ancho mínimo para que el texto + el indicador de orden quepan en
        // una línea (S4): el texto mide ~85px y el indicador reserva 12px.
        size: 140,
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
        size: 120,
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
        size: 135,
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
        size: 80,
        cell: (info) => (
          <Link
            to={`/solds/${info.row.original.id}`}
            // viewTransition (RR 7+) usa la View Transitions API del browser
            // para animar la navegación /solds → /solds/:id. Default = cross-fade.
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

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table
  const table = useReactTable<SoldWithCustomer>({
    data: filteredSolds,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  /**
   * Cambia la query del buscador. La tabla es virtualizada (scroll infinito),
   * así que no hay páginas que resetear: el filtro se aplica sobre todas las
   * filas.
   */
  const handleQueryChange = (value: string) => {
    setQuery(value);
    table.setPageIndex(0);
  };

  /** Texto del contador de resultados. */
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
      {/* Header */}
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
      )}
      {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}
    </div>
  );
}
