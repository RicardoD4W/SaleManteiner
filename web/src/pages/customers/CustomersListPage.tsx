/**
 * Vista de Clientes (S1 del feature clientes-crud).
 *
 * Lista los clientes con:
 *  - Nombre.
 *  - Número de ventas: se cuenta cruzando las ventas con el cliente
 *    (`useSolds` + `useCustomers`). La API de clientes no expone esta
 *    métrica y `topBuyers` del dashboard está limitado a 10, así que se
 *    calcula en el cliente con los datos que ya trae `GET /api/solds`.
 *  - Total gastado: suma de `sale_price` de las ventas de ese cliente.
 *  - Acción "Editar" (abre el `CustomerFormModal`).
 *
 * Tabla simple (no virtualizada): la lista de clientes es corta y una
 * tabla semántica se lee mejor con lectores de pantalla.
 *
 * El borrado de clientes (S3) NO está: lo implementan WU2 (server) y WU3
 * (web) del mismo feature.
 *
 * Estados de carga y de error como en el resto de páginas (`Spinner` +
 * botón "Reintentar").
 */
import { useMemo, useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useSolds } from '../../hooks/useSolds';
import { useSortable, type SortDir } from '../../hooks/useSortable';
import { Spinner } from '../../components/ui/Spinner';
import { tableHeadClass } from '../../components/ui/tableStyles';
import { CustomerFormModal } from '../../components/sales/CustomerFormModal';
import { formatEuro } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { Customer } from '../../schemas/customers';

/** Fila de la tabla: el cliente + sus métricas de ventas. */
interface CustomerRow {
  id: number;
  name: string;
  ventas: number;
  total_gastado: number;
  /** Cliente original (para abrir el modal de edición). */
  customer: Customer;
}

/** Cabecera ordenable (sort de 3 estados, como en las tabs del dashboard). */
function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: keyof CustomerRow;
  currentKey: keyof CustomerRow | null;
  currentDir: SortDir;
  onSort: (key: keyof CustomerRow) => void;
}) {
  const isActive = currentKey === sortKey;
  const indicator = isActive ? (currentDir === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer ${tableHeadClass} text-left`}
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="whitespace-nowrap">{label}</span>
      {/* El hueco del indicador se reserva siempre (anchura fija): si no, al
          ordenar aparece el ▼, la columna crece y la tabla se desajusta. */}
      <span className="ml-1 inline-block w-3">{indicator}</span>
    </th>
  );
}

export function CustomersListPage() {
  const { data: customers, isLoading, isError, error, refetch } = useCustomers();
  const { data: solds } = useSolds();
  /** Cliente en edición (null = el modal de edición está cerrado). */
  const [editing, setEditing] = useState<Customer | null>(null);
  /** ¿Está abierto el modal de alta? */
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Métricas por cliente: número de ventas y total gastado.
   * Se cruzan las ventas (`GET /api/solds`) con los clientes; no hay
   * endpoint de server que devuelva estas dos métricas por cliente.
   */
  const metricsByCustomer = useMemo(() => {
    const map = new Map<number, { ventas: number; total_gastado: number }>();
    for (const sold of solds ?? []) {
      const previous = map.get(sold.customer_id) ?? { ventas: 0, total_gastado: 0 };
      map.set(sold.customer_id, {
        ventas: previous.ventas + 1,
        total_gastado: round2(previous.total_gastado + sold.sale_price),
      });
    }
    return map;
  }, [solds]);

  const rows = useMemo<CustomerRow[]>(
    () =>
      (customers ?? []).map((customer) => {
        const metrics = metricsByCustomer.get(customer.id);
        return {
          id: customer.id,
          name: customer.name,
          ventas: metrics?.ventas ?? 0,
          total_gastado: metrics?.total_gastado ?? 0,
          customer,
        };
      }),
    [customers, metricsByCustomer],
  );

  // Sin sort por defecto: el server ya devuelve los clientes ordenados por
  // nombre (COLLATE NOCASE), así que sin sort se ven en ese orden.
  const { sortedItems, sortKey, sortDir, onSort } = useSortable<CustomerRow>(rows);

  /** Cierra el modal que estuviera abierto (alta o edición). */
  const closeModals = () => {
    setIsCreating(false);
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando clientes…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <p>No se pudieron cargar los clientes: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Clientes</h2>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400"
        >
          + Nuevo cliente
        </button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">No hay clientes todavía.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <SortHeader
                  label="Cliente"
                  sortKey="name"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Ventas"
                  sortKey="ventas"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Total gastado"
                  sortKey="total_gastado"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <th scope="col" className={`${tableHeadClass} text-left`}>
                  <span className="whitespace-nowrap">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sortedItems.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {row.name}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                    {row.ventas}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                    {formatEuro(row.total_gastado)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setEditing(row.customer)}
                      // El nombre accesible dice a QUIÉN se edita: hay un
                      // "Editar" por fila y sin esto el lector de pantalla
                      // no dice qué cliente es.
                      aria-label={`Editar ${row.name}`}
                      className="text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-offset-gray-900"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            {sortedItems.length === 1 ? '1 cliente' : `${sortedItems.length} clientes`}
          </div>
        </div>
      )}

      {isCreating ? <CustomerFormModal mode="create" onClose={closeModals} /> : null}
      {editing ? <CustomerFormModal mode="edit" customer={editing} onClose={closeModals} /> : null}
    </div>
  );
}
