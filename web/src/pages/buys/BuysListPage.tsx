/**
 * Página de listado de compras (S4 del feature).
 *
 * Tabla con TanStack Table:
 *  - Producto, Coste, Cantidad, Asociados, Fecha compra, Disponibles, Acciones.
 *  - Disponibles = quantity - SUM(sale_items.quantity).
 *  - Acciones → enlace a /buys/:id (editar) + botón de borrar (S1 del
 *    feature `acciones-en-listas`).
 *
 *  S3 del feature dashboard-iteration-1: el botón "+ Nueva compra" ahora
 *  abre el `BuyNewModal` en vez de navegar a `/buys/new`.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
import { DeleteDialogs, type DeleteTarget } from '../../components/sales/DeleteDialogs';
import { formatDate, formatEuro } from '../../lib/format';
import { filterBuys } from '../../lib/searchQuery';
import type { BuyWithStock } from '../../api/buys';
import type { Buy } from '../../schemas/buys';

const columnHelper = createColumnHelper<BuyWithStock>();

/**
 * Nombre de la view transition de elemento compartido (S3).
 *
 * La clave es el **id** de la compra y no el nombre del producto: el
 * `view-transition-name` tiene que ser un `custom-ident` válido (sin
 * espacios) y único en el documento, y el nombre del producto puede
 * repetirse entre filas. El id cumple las dos condiciones.
 */
function nombreTransicion(id: number): string {
  return `buy-product-${id}`;
}

/**
 * Lee el id de la fila armada que viaja en el `state` de la navegación
 * (la vuelta desde `/buys/:id`).
 */
function leerFilaArmada(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('filaArmada' in state)) return null;
  const valor = (state as { filaArmada?: unknown }).filaArmada;
  return typeof valor === 'number' ? valor : null;
}

/**
 * Estado de la transición de elemento compartido (S3), para las celdas.
 *
 * Las celdas son COMPONENTES DE MÓDULO (ver `CeldaProducto`): TanStack
 * renderiza el renderer de la celda con `React.createElement`, así que si
 * su identidad cambiara, React lo remontaría y el nodo del enlace "Editar"
 * se recrearía entre el pointerdown y el click → el click se perdería (y
 * con él, la navegación). Por eso el estado llega a las celdas por
 * contexto y las columnas se crean una sola vez.
 */
interface ContextoArmado {
  /** Id de la fila armada (la que lleva el `view-transition-name`). */
  filaArmada: number | null;
  /** Arma una fila para la transición. */
  armarFila: (fila: BuyWithStock) => void;
}

const ContextoArmado = createContext<ContextoArmado>({
  filaArmada: null,
  armarFila: () => {},
});

/**
 * Celda de producto: es la que lleva el `view-transition-name` de la fila
 * armada (S3).
 *
 * Como la tabla está virtualizada hay varias filas en el DOM, así que solo
 * una —la que se va a abrir— lo lleva: el nombre tiene que ser único en el
 * documento.
 */
function CeldaProducto({ fila }: { fila: BuyWithStock }) {
  const { filaArmada } = useContext(ContextoArmado);
  const armada = fila.id === filaArmada;
  return (
    <span
      className="font-medium"
      style={armada ? { viewTransitionName: nombreTransicion(fila.id) } : undefined}
      data-vt-nombre={armada ? nombreTransicion(fila.id) : undefined}
    >
      {fila.product_name}
    </span>
  );
}

/**
 * Celda de acciones: "Editar" (arma la fila para la transición) + "Borrar".
 */
function CeldaAcciones({
  fila,
  onBorrar,
}: {
  fila: BuyWithStock;
  onBorrar: (fila: BuyWithStock) => void;
}) {
  const { armarFila } = useContext(ContextoArmado);
  return (
    <div className="flex items-center gap-3">
      <Link
        to={`/buys/${fila.id}`}
        // viewTransition (RR 7+) usa la View Transitions API del browser
        // para animar la navegación /buys → /buys/:id. Default = cross-fade.
        // Degrada a instantáneo en navegadores sin soporte (Safari < 18, Firefox < 134).
        viewTransition
        // S3: armar la fila al apuntarla. El snapshot del DOM viejo se toma
        // en el click, así que el `view-transition-name` tiene que estar
        // puesto ANTES (de ahí los tres eventos: mouse, foco y puntero —
        // el puntero cubre el táctil).
        onMouseEnter={() => armarFila(fila)}
        onFocus={() => armarFila(fila)}
        onPointerDown={() => armarFila(fila)}
        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={() => onBorrar(fila)}
        // Nombre accesible: identifica el registro (la fila concreta que se
        // va a borrar), no un "Borrar" ambiguo.
        aria-label={`Borrar ${fila.product_name}`}
        className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
      >
        Borrar
      </button>
    </div>
  );
}

export function BuysListPage() {
  const { data, isLoading, isError, error, refetch } = useBuys();
  // Sin sort por defecto: el user pide explícitamente el estado idle (ni asc ni desc).
  // El server ya devuelve los buys en id DESC, así que sin sort se ve lo más nuevo arriba.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  /** Query del buscador (client-side). */
  const [query, setQuery] = useState('');
  /**
   * Compra que se va a borrar (S1 del feature `acciones-en-listas`).
   * La modal se renderiza a nivel de página (fuera de la tabla) porque las
   * filas tienen `transform: translateY(...)` y eso rompería el
   * `position: fixed` del backdrop.
   */
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  /**
   * Fila "armada" para la view transition de elemento compartido (S3).
   *
   * Guarda el id de la fila y la clave de la navegación en la que se armó:
   * al volver del formulario (otra navegación) el armado anterior deja de
   * tener efecto y manda el que viene en el `state` de la navegación.
   */
  const [armada, setArmada] = useState<{ id: number; navegacion: string } | null>(null);
  const location = useLocation();
  const queryClient = useQueryClient();

  /** Fila que vuelve armada desde la página de edición (S3). */
  const filaDesdeEstado = leerFilaArmada(location.state);
  /** La fila armada: la que está bajo el puntero, o la que vuelve del form. */
  const filaArmada = armada && armada.navegacion === location.key ? armada.id : filaDesdeEstado;

  /**
   * Arma la fila para la transición de elemento compartido (S3).
   *
   *  - El `view-transition-name` lo lleva la celda de producto (mira
   *    `filaArmada`); tiene que estar puesto ANTES del click, porque el
   *    navegador toma la foto del DOM viejo en el momento del click.
   *  - Además deja el registro en la caché de react-query: así el
   *    formulario de edición existe desde su primer render y su input
   *    (que lleva el mismo nombre) está en la foto del DOM nuevo. Sin
   *    esto, el form se pintaría con su spinner y no habría contra qué
   *    morphing.
   */
  const armarFila = useCallback(
    (buy: BuyWithStock) => {
      setArmada({ id: buy.id, navegacion: location.key });
      queryClient.setQueryData<Buy>(['buys', buy.id], {
        id: buy.id,
        product_name: buy.product_name,
        purchase_cost: buy.purchase_cost,
        quantity: buy.quantity,
        associated_costs: buy.associated_costs,
        purchase_date: buy.purchase_date,
        created_at: buy.created_at,
      });
    },
    [location.key, queryClient],
  );

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
        // El ancho de las columnas es una "repartición" del espacio
        // disponible (el `size` es el factor de crecimiento del flex), no
        // un ancho fijo: por eso "Producto" cede espacio a "Acciones"
        // (que necesita los dos enlaces, "Editar" y "Borrar").
        size: 220,
        // El nombre NO es link — el user pidió que no se pueda editar
        // haciendo click en el nombre. La edición sigue disponible vía
        // la columna "Acciones" → "Editar".
        cell: (info) => <CeldaProducto fila={info.row.original} />,
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
        // Ancho mínimo para que quepan los dos enlaces ("Editar" y
        // "Borrar") sin que la columna se corte: el contenido necesita
        // ~125px (padding + los dos textos + el gap).
        size: 140,
        cell: (info) => (
          <CeldaAcciones
            fila={info.row.original}
            onBorrar={(fila) =>
              setDeleteTarget({ tipo: 'compra', id: fila.id, nombre: fila.product_name })
            }
          />
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

  /**
   * Estado de la transición que consumen las celdas (S3).
   *
   * Va por contexto (y no como dependencia de las columnas) para que las
   * columnas se creen una sola vez: recrearlas remontaría las celdas y el
   * nodo del enlace "Editar" se recrearía entre el pointerdown y el click
   * → el click se perdería.
   */
  const valorArmado = useMemo<ContextoArmado>(
    () => ({ filaArmada, armarFila }),
    [filaArmada, armarFila],
  );

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
        <ContextoArmado.Provider value={valorArmado}>
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
        </ContextoArmado.Provider>
      )}
      {isModalOpen ? <BuyNewModal onClose={() => setIsModalOpen(false)} /> : null}
      {/* El flujo de borrado vive a nivel de página, no dentro de la fila. */}
      <DeleteDialogs target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
