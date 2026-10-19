/**
 * Tab Compradores (T12 de feature-buys-and-solds + S8 del feature
 * dashboard-iteration-1).
 *
 * Cambios del feature:
 *  - S8: la tabla pasa a ser ordenable de 3 estados (neutral → ascendente →
 *    descendente → neutral) usando el hook `useSortable`.
 */
import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useSortable } from '../../hooks/useSortable';
import { formatEuro } from '../../lib/format';

type BuyerRow = {
  customer_id: number;
  customer_name: string;
  ventas: number;
  total_gastado: number;
};

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  align = 'left',
  onSort,
}: {
  label: string;
  sortKey: keyof BuyerRow;
  currentKey: keyof BuyerRow | null;
  currentDir: 'asc' | 'desc' | null;
  align?: 'left' | 'right';
  onSort: (key: keyof BuyerRow) => void;
}) {
  const isActive = currentKey === sortKey;
  const indicator = isActive ? (currentDir === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      className={[
        'cursor-pointer select-none px-3 py-2 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
      aria-sort={
        isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      {label}
      {indicator ? <span className="ml-1">{indicator}</span> : null}
    </th>
  );
}

export function BuyersTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

  const { sortedItems, sortKey, sortDir, onSort } = useSortable<BuyerRow>(
    (data?.topBuyers ?? []) as BuyerRow[],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando top compradores…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600 dark:text-red-400">Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Reintentar
          </button>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Compradores
          </h3>
          {sortedItems.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay ventas registradas para armar el ranking.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <table
                className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800"
                data-testid="buyers-table"
              >
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <SortHeader
                      label="Cliente"
                      sortKey="customer_name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Ventas"
                      sortKey="ventas"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      align="right"
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Total gastado"
                      sortKey="total_gastado"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      align="right"
                      onSort={onSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {sortedItems.map((b) => (
                    <tr key={b.customer_id}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                        {b.customer_name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {b.ventas}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatEuro(b.total_gastado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
