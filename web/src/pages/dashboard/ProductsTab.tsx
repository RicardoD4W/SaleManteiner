import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { TopProductsChart } from '../../components/dashboard/TopProductsChart';
import { formatEuro } from '../../lib/format';

/**
 * Tab Productos (T12): TopProductsChart + tabla detalle.
 * Importes en EUROS.
 */
export function ProductsTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

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
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Top 10 productos por revenue</h3>
          {data.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay ventas vendidas para armar el ranking.
            </p>
          ) : (
            <TopProductsChart data={data.topProducts} />
          )}
        </CardBody>
      </Card>

      {data.topProducts.length > 0 ? (
        <Card>
          <CardBody>
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Detalle</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <table
                className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800"
                data-testid="products-table"
              >
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Veces vendido
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {data.topProducts.map((p) => (
                    <tr key={p.product_name}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{p.product_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {p.times_sold}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatEuro(p.total_revenue)}
                      </td>
                      <td
                        className={[
                          'px-3 py-2 text-right tabular-nums',
                          p.total_profit >= 0 ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400',
                        ].join(' ')}
                      >
                        {formatEuro(p.total_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
