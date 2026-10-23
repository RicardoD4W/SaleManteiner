import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useSortable } from '../../hooks/useSortable';
import { formatEuro } from '../../lib/format';
import { SortableTableHead } from '../../components/ui/SortableTableHead';
import { ErrorState } from '../../components/ui/ErrorState';

type BuyerRow = {
  customer_id: number;
  customer_name: string;
  ventas: number;
  total_gastado: number;
};

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
          <ErrorState message={`Error: ${error.message}`} onRetry={() => refetch()} />
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Compradores</h3>
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
                    <SortableTableHead<BuyerRow>
                      label="Cliente"
                      sortKey="customer_name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTableHead<BuyerRow>
                      label="Ventas"
                      sortKey="ventas"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTableHead<BuyerRow>
                      label="Total gastado"
                      sortKey="total_gastado"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {sortedItems.map((b) => (
                    <tr key={b.customer_id}>
                      <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                        {b.customer_name}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                        {b.ventas}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
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
