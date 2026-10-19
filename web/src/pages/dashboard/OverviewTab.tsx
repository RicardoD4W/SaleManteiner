/**
 * Tab Overview (T12 de feature-buys-and-solds + S2, S5 y S6 del feature
 * dashboard-iteration-1).
 *
 * Cambios del feature dashboard-iteration-1:
 *  - S2: la KPI "Beneficio neto" pasa a llamarse "Beneficio" y su color
 *    depende del signo: rojo si < 0, naranja si === 0, verde si > 0.
 *  - S5: el chart ahora es CashFlowChart (línea de neto por mes con áreas
 *    verde/rojo), no RevenueChart.
 *  - S6: las secciones "Top 5 productos" y "Top 5 compradores" son
 *    colapsables con persistencia en localStorage, y se quita el link
 *    "Ver todos".
 */
import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { useCollapsible } from '../../hooks/useCollapsible';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { CashFlowChart } from '../../components/dashboard/CashFlowChart';
import { formatEuro } from '../../lib/format';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Color de énfasis (por defecto gris neutro; admite variantes dinámicas). */
  valueClassName?: string;
}

function StatCard({ label, value, hint, valueClassName }: StatCardProps) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p
          className={[
            'mt-1 text-2xl font-semibold tabular-nums',
            valueClassName ?? 'text-gray-900 dark:text-gray-100',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

/** Clases Tailwind para el color dinámico del KPI "Beneficio" (S2). */
function beneficioColorClass(value: number): string {
  if (value < 0) return 'text-red-600 dark:text-red-400';
  if (value === 0) return 'text-orange-500 dark:text-orange-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function OverviewTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();
  const products = useCollapsible('dashboard-overview-products-collapsed', false);
  const buyers = useCollapsible('dashboard-overview-compradores-collapsed', false);

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
          label="Beneficio"
          value={`${netSign}${formatEuro(k.beneficio_total_eur)}`}
          hint="ventas − COGS − gastos"
          valueClassName={beneficioColorClass(k.beneficio_total_eur)}
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
            Cash flow de los últimos 12 meses
          </h3>
          <CashFlowChart data={data.cashFlowByMonth} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Top 5 productos — colapsable (S6) */}
        <Card>
          <CardBody className="p-0">
            <button
              type="button"
              onClick={products.toggle}
              aria-expanded={products.isOpen}
              aria-controls="overview-top-products"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                Top 5 productos
              </h3>
              <span
                aria-hidden="true"
                className="text-gray-400 dark:text-gray-500"
              >
                {products.isOpen ? '▼' : '▶'}
              </span>
            </button>
            {products.isOpen ? (
              <div id="overview-top-products" className="px-4 pb-4">
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
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
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Top 5 compradores — colapsable (S6) */}
        <Card>
          <CardBody className="p-0">
            <button
              type="button"
              onClick={buyers.toggle}
              aria-expanded={buyers.isOpen}
              aria-controls="overview-top-compradores"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                Top 5 compradores
              </h3>
              <span
                aria-hidden="true"
                className="text-gray-400 dark:text-gray-500"
              >
                {buyers.isOpen ? '▼' : '▶'}
              </span>
            </button>
            {buyers.isOpen ? (
              <div id="overview-top-compradores" className="px-4 pb-4">
                {data.topBuyers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
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
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
