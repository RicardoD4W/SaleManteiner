import { Link } from 'react-router-dom';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { formatCents } from '../../lib/format';

/**
 * Tab Overview (Fase 5 / S6):
 *   - 4 cards de KPIs del dashboard (Total, Vendidas, Ingresos, Beneficio neto).
 *   - Mini chart de revenue (mismos datos que RevenueTab, solo distinto tamaño).
 *   - Top 5 productos rápido para tener info útil en un solo vistazo,
 *     con link "Ver todos" hacia ProductsTab.
 */
interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}

function StatCard({ label, value, hint, emphasis = false }: StatCardProps) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p
          className={[
            'mt-1 text-2xl font-semibold tabular-nums',
            emphasis ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function OverviewTab() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Spinner size="sm" /> Cargando dashboard…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600 dark:text-red-400">
            No se pudo cargar el dashboard: {error.message}
          </p>
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

  const k = data.kpis;
  const netSign = k.net_profit_cents >= 0 ? '+' : '';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="overview-kpis">
        <StatCard label="Total" value={String(k.total)} hint="ventas registradas" />
        <StatCard
          label="Vendidas"
          value={String(k.sold)}
          hint={`${k.not_sold} pendientes`}
        />
        <StatCard
          label="Ingresos"
          value={formatCents(k.revenue_cents)}
          hint="acumulado histórico"
        />
        <StatCard
          label="Beneficio neto"
          value={`${netSign}${formatCents(k.net_profit_cents)}`}
          hint="revenue − costes"
          emphasis
        />
      </div>

      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Ingresos de los últimos 12 meses
          </h3>
          <RevenueChart data={data.revenueByMonth} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Top 5 productos</h3>
            <Link
              to="/dashboard/products"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Sin ventas vendidas todavía.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
              {data.topProducts.slice(0, 5).map((p) => (
                <li
                  key={p.product_name}
                  className="flex items-baseline justify-between py-2 text-sm"
                >
                  <span className="text-gray-800 dark:text-gray-200">{p.product_name}</span>
                  <span className="tabular-nums text-gray-600 dark:text-gray-400">
                    {formatCents(p.total_revenue_cents)}
                    <span className="ml-2 text-xs text-gray-400">
                      · {p.times_sold}×
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
