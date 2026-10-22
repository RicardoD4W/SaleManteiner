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

/**
 * Nombre de la view transition de elemento compartido (S3).
 *
 * La clave es el **id** de la venta: el `view-transition-name` tiene que ser
 * un `custom-ident` válido (sin espacios) y único en el documento, y el
 * nombre del cliente puede repetirse entre filas.
 *
 * `campo` distingue los campos que viajan (cliente, precio, asociados…):
 * cada campo necesita su propio nombre para que el navegador los empareje
 * por separado (cada input del formulario tiene su pareja en la fila).
 */
function nombreTransicion(campo: string, id: number): string {
  return `sold-${campo}-${id}`;
}

/**
 * Lee el id de la fila armada que viaja en el `state` de la navegación
 * (la vuelta desde `/solds/:id`).
 */
function leerFilaArmada(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('filaArmada' in state)) return null;
  const valor = (state as { filaArmada?: unknown }).filaArmada;
  return typeof valor === 'number' ? valor : null;
}

/**
 * Estado de la transición de elemento compartido (S3), para las celdas.
 *
 * Las celdas son COMPONENTES DE MÓDULO (ver `CeldaCliente`): TanStack
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
  armarFila: (fila: SoldWithCustomer) => void;
}

const ContextoArmado = createContext<ContextoArmado>({
  filaArmada: null,
  armarFila: () => {},
});

/**
 * Celda que viaja al formulario (view transition de elemento compartido).
 *
 * Cuando la fila está "armada", la celda lleva el `view-transition-name`
 * y viaja como chip de texto hasta el input que le corresponde en el
 * formulario (ver `index.css`).
 *
 * En `/solds` lo que identifica la venta en la tabla es el cliente (los
 * productos del pack son de solo lectura en el formulario), así que el
 * cliente es el chip principal; los importes y la fecha viajan también.
 */
function CeldaViajera({
  fila,
  campo,
  className,
  children,
}: {
  fila: SoldWithCustomer;
  /** Campo del formulario al que viaja (client, price, date…). */
  campo: string;
  /** Clases del texto de la celda. */
  className?: string;
  children: ReactNode;
}) {
  const { filaArmada } = useContext(ContextoArmado);
  const armada = fila.id === filaArmada;
  const nombre = nombreTransicion(campo, fila.id);
  return (
    <span
      // `vt-celda`: marca el elemento como el que viaja como chip de texto
      // en la view transition (ver index.css).
      className={['vt-celda', className ?? ''].join(' ')}
      style={armada ? { viewTransitionName: nombre } : undefined}
      data-vt-nombre={armada ? nombre : undefined}
    >
      {children}
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
  fila: SoldWithCustomer;
  onBorrar: (fila: SoldWithCustomer) => void;
}) {
  const { armarFila } = useContext(ContextoArmado);
  return (
    <div className="flex items-center gap-3">
      <Link
        to={`/solds/${fila.id}`}
        // viewTransition (RR 7+) usa la View Transitions API del browser
        // para animar la navegación /solds → /solds/:id. Default = cross-fade.
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
        aria-label={`Borrar venta #${fila.id}`}
        // `cursor-pointer`: el preflight de Tailwind 4 no lo pone en los
        // <button> (en v3 sí), así que sin esto el puntero sale como flecha
        // mientras que el link "Editar" sí muestra la manita.
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
  // Sin sort por defecto: el user pide explícitamente el estado idle (ni asc ni desc).
  // El server ya devuelve las solds en id DESC, así que sin sort se ve
  // lo más nuevo arriba.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  /** Query del buscador (client-side). */
  const [query, setQuery] = useState('');
  /**
   * Venta que se va a borrar (S1 del feature `acciones-en-listas`).
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
   *  - El `view-transition-name` lo lleva la celda de cliente (mira
   *    `filaArmada`); tiene que estar puesto ANTES del click, porque el
   *    navegador toma la foto del DOM viejo en el momento del click.
   *  - Además deja la venta en la caché de react-query: así el formulario
   *    de edición existe desde su primer render y su input de cliente
   *    (que lleva el mismo nombre) está en la foto del DOM nuevo.
   */
  const armarFila = useCallback(
    (sold: SoldWithCustomer) => {
      setArmada({ id: sold.id, navegacion: location.key });
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
        size: 115,
        cell: (info) => (
          <CeldaViajera
            fila={info.row.original}
            campo="date"
            className="whitespace-nowrap text-gray-700 dark:text-gray-300"
          >
            {formatDate(info.getValue())}
          </CeldaViajera>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor((row) => row.customerName, {
        id: 'customer',
        header: 'Cliente',
        size: 140,
        cell: (info) => (
          <CeldaViajera
            fila={info.row.original}
            campo="client"
            className="text-gray-800 dark:text-gray-200"
          >
            {info.row.original.customerName}
          </CeldaViajera>
        ),
        sortingFn: 'basic',
      }),
      // Productos vendidos (S de UI: mostrar en la lista qué se vendió
      // y cuántas unidades, sin abrir el detalle). Una línea por item
      // del pack; cada línea con el formato "nombre × cantidad".
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
          <CeldaViajera
            fila={info.row.original}
            campo="price"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {formatEuro(info.getValue())}
          </CeldaViajera>
        ),
        sortingFn: 'basic',
      }),
      columnHelper.accessor('associated_costs', {
        header: 'Asociados (€)',
        // Ancho mínimo para que el texto + el indicador de orden quepan en
        // una línea (S4): el texto mide ~85px y el indicador reserva 12px.
        size: 140,
        cell: (info) => (
          <CeldaViajera
            fila={info.row.original}
            campo="associated"
            className="tabular-nums text-gray-700 dark:text-gray-300"
          >
            {formatEuro(info.getValue())}
          </CeldaViajera>
        ),
        sortingFn: 'basic',
      }),
      // Beneficio calculado por el server (sale_price - associated_costs -
      // COGS_prorrateado - buy.associated_prorrateado, S13 del feature).
      // Positivo en emerald, negativo en rojo, cero en gris.
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
        // Ancho mínimo para que quepan los dos enlaces ("Editar" y
        // "Borrar") sin que la columna se corte: el contenido necesita
        // ~125px (padding + los dos textos + el gap).
        size: 130,
        cell: (info) => (
          <CeldaAcciones
            fila={info.row.original}
            onBorrar={(fila) => setDeleteTarget({ tipo: 'venta', id: fila.id })}
          />
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
        <ContextoArmado.Provider value={valorArmado}>
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
        </ContextoArmado.Provider>
      )}
      {isModalOpen ? <SaleNewModal onClose={() => setIsModalOpen(false)} /> : null}
      {/* El flujo de borrado vive a nivel de página, no dentro de la fila. */}
      <DeleteDialogs target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
