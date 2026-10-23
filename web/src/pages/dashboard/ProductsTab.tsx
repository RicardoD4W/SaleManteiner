import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useSortable } from '../../hooks/useSortable';
import { formatEuro } from '../../lib/format';
import { SortableTableHead } from '../../components/ui/SortableTableHead';
import { ErrorState } from '../../components/ui/ErrorState';

type ProductRow = {
  product_id: number;
  product_name: string;
  times_sold: number;
  total_revenue: number;
  total_profit: number;
};

export function ProductsTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

  const { sortedItems, sortKey, sortDir, onSort } = useSortable<ProductRow>(
    (data?.topProducts ?? []) as ProductRow[],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando top productos…
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
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Productos vendidos
          </h3>
          {sortedItems.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay ventas vendidas para armar el ranking.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <table
                className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800"
                data-testid="products-table"
              >
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <SortableTableHead<ProductRow>
                      label="Producto"
                      sortKey="product_name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTableHead<ProductRow>
                      label="Veces vendido"
                      sortKey="times_sold"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTableHead<ProductRow>
                      label="Precio de venta"
                      sortKey="total_revenue"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                    <SortableTableHead<ProductRow>
                      label="Beneficio"
                      sortKey="total_profit"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={onSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {sortedItems.map((p) => (
                    <tr key={p.product_id}>
                      <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                        {p.product_name}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                        {p.times_sold}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                        {formatEuro(p.total_revenue)}
                      </td>
                      <td
                        className={[
                          'px-4 py-2 tabular-nums',
                          p.total_profit >= 0
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-red-700 dark:text-red-400',
                        ].join(' ')}
                      >
                        {formatEuro(p.total_profit)}
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
