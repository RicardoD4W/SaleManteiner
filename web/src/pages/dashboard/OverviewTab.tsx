import { Link } from 'react-router-dom';
import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { formatEuro } from '../../lib/format';

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
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p
          className={[
            'mt-1 text-2xl font-semibold tabular-nums',
            emphasis ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

/**
 * Tab Overview (T12 de feature-buys-and-solds):
 *   - 4 cards de KPIs del nuevo modelo: Compras totales, Ventas totales,
 *     Beneficio neto, Stock pendiente.
 *   - Mini chart de revenue (mismos datos que RevenueTab).
 *   - Top 5 productos con link "Ver todos" → ProductsTab.
 *   - Top 5 compradores con link "Ver todos" → BuyersTab.
 */
export function OverviewTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
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
  const netSign = k.beneficio_total_eur >= 0 ? '+' : '';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="overview-kpis">
        <StatCard
          label="Compras totales"
          value={formatEuro(k.compras_total_eur)}
          hint="inversión acumulada"
        />
        <StatCard
          label="Ventas totales"
          value={formatEuro(k.ventas_total_eur)}
          hint="revenue acumulado"
        />
        <StatCard
          label="Beneficio neto"
          value={`${netSign}${formatEuro(k.beneficio_total_eur)}`}
          hint="ventas − COGS − gastos"
          emphasis
        />
        <StatCard
          label="Stock pendiente"
          value={String(k.stock_pendiente_count)}
          hint="compras con stock"
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Top 5 productos</h3>
              <Link
                to="/dashboard/products"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Ver todos →
              </Link>
            </div>
            {data.topProducts.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                {data.topProducts.slice(0, 5).map((p) => (
                  <li
                    key={p.product_name}
                    className="flex items-baseline justify-between py-2 text-sm"
                  >
                    <span className="text-gray-800 dark:text-gray-200">{p.product_name}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {formatEuro(p.total_revenue)}
                      <span className="ml-2 text-xs text-gray-400">· {p.times_sold}×</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Top 5 compradores</h3>
              <Link
                to="/dashboard/buyers"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Ver todos →
              </Link>
            </div>
            {data.topBuyers.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                {data.topBuyers.slice(0, 5).map((b) => (
                  <li
                    key={b.customer_id}
                    className="flex items-baseline justify-between py-2 text-sm"
                  >
                    <span className="text-gray-800 dark:text-gray-200">{b.customer_name}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {formatEuro(b.total_gastado)}
                      <span className="ml-2 text-xs text-gray-400">· {b.ventas}×</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
