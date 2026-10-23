import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { LazyCashFlowChart } from '../../components/dashboard/LazyCashFlowChart';
import { formatEuro } from '../../lib/format';

export function RevenueTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando ingresos…
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

  const ytdRevenue = data.cashFlowByMonth.reduce((acc, m) => acc + m.ingresos, 0);
  const ytdProfit = data.cashFlowByMonth.reduce((acc, m) => acc + m.beneficio, 0);
  const monthsWithSales = data.cashFlowByMonth.filter((m) => m.ingresos > 0);
  const bestMonth = monthsWithSales.reduce(
    (best, m) => (m.ingresos > best.ingresos ? m : best),
    monthsWithSales[0] ?? null,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="revenue-totals">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Ingresos
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {formatEuro(ytdRevenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">últimos 12 meses</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Beneficio
            </p>
            <p
              className={[
                'mt-1 text-2xl font-semibold tabular-nums',
                ytdProfit >= 0
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-red-600 dark:text-red-400',
              ].join(' ')}
            >
              {formatEuro(ytdProfit)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ingresos menos los costes de cada venta
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Mejor mes
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {bestMonth ? formatEuro(bestMonth.ingresos) : '—'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {bestMonth ? bestMonth.month : 'sin ventas registradas'}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Flujo de caja por mes
          </h3>
          <LazyCashFlowChart data={data.cashFlowByMonth} />
        </CardBody>
      </Card>
    </div>
  );
}
