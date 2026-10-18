import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { formatEuro } from '../../lib/format';

/**
 * Tab Compradores (T12 de feature-buys-and-solds):
 *   - Top 10 compradores por total gastado.
 *   - Tabla detalle con nombre, número de ventas, total gastado.
 *
 * El feature doc S11 define `topBuyers` en el payload del dashboard
 * (top 10 compradores con `customer_id`, `customer_name`, `ventas`,
 * `total_gastado`). El sort es por `total_gastado DESC`.
 */
export function BuyersTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

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
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Top 10 compradores por total gastado</h3>
          {data.topBuyers.length === 0 ? (
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
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Ventas
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Total gastado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {data.topBuyers.map((b) => (
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
