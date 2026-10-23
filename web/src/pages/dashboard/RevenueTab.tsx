import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { StatCard, profitColorClass } from '../../components/dashboard/StatCard';
import { Spinner } from '../../components/ui/Spinner';
import { LazyCashFlowChart } from '../../components/dashboard/LazyCashFlowChart';
import { formatEuro } from '../../lib/format';
import { ErrorState } from '../../components/ui/ErrorState';

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
          <ErrorState message={`Error: ${error.message}`} onRetry={() => refetch()} />
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
        <StatCard label="Ingresos" value={formatEuro(ytdRevenue)} hint="últimos 12 meses" />
        <StatCard
          label="Beneficio"
          value={formatEuro(ytdProfit)}
          hint="Ingresos menos los costes de cada venta"
          valueClassName={profitColorClass(ytdProfit)}
        />
        <StatCard
          label="Mejor mes"
          value={bestMonth ? formatEuro(bestMonth.ingresos) : '—'}
          hint={bestMonth ? bestMonth.month : 'sin ventas registradas'}
        />
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
