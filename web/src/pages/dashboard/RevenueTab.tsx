import { useDashboardStats } from '../../hooks/useDashboardStats';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { formatCents } from '../../lib/format';

/**
 * Tab Ingresos (Fase 5 / S7):
 *   - RevenueChart grande con revenue (verde) + profit (azul punteado) por mes.
 *   - Totales agregados YTD (últimos 12 meses): revenue total + profit total.
 *   - Mes mejor / mes peor para tener contexto de los extremos.
 */
export function RevenueTab() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Spinner size="sm" /> Cargando revenue…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600">Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-brand-600 hover:underline"
          >
            Reintentar
          </button>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const ytdRevenue = data.revenueByMonth.reduce((acc, m) => acc + m.revenue_cents, 0);
  const ytdProfit = data.revenueByMonth.reduce((acc, m) => acc + m.profit_cents, 0);
  const monthsWithSales = data.revenueByMonth.filter((m) => m.revenue_cents > 0);
  const bestMonth = monthsWithSales.reduce(
    (best, m) => (m.revenue_cents > best.revenue_cents ? m : best),
    monthsWithSales[0] ?? null,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="revenue-totals">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Revenue YTD
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {formatCents(ytdRevenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500">últimos 12 meses</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Profit YTD
            </p>
            <p
              className={[
                'mt-1 text-2xl font-semibold tabular-nums',
                ytdProfit >= 0 ? 'text-gray-900' : 'text-red-600',
              ].join(' ')}
            >
              {formatCents(ytdProfit)}
            </p>
            <p className="mt-1 text-xs text-gray-500">revenue − costes − asociados</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Mejor mes
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {bestMonth ? formatCents(bestMonth.revenue_cents) : '—'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {bestMonth ? bestMonth.month : 'sin ventas registradas'}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900">Revenue y profit por mes</h3>
          <RevenueChart data={data.revenueByMonth} />
        </CardBody>
      </Card>
    </div>
  );
}
