/**
 * Tab Overview (T12 de feature-buys-and-solds + S2 y S5 del feature
 * dashboard-iteration-1, simplificado en el feature phase-8-polish-e2e-docs).
 *
 * Cambios del feature dashboard-iteration-1:
 *  - S2: la KPI "Beneficio neto" pasa a llamarse "Beneficio" y su color
 *    depende del signo: rojo si < 0, naranja si === 0, verde si > 0.
 *  - S5: el chart muestra dos series (compras / ventas) por mes, no la
 *    línea de neto.
 *
 * Cambios posteriores:
 *  - El header del chart se traduce a "Flujo de caja de los últimos 12
 *    meses" (sin "Cash flow" en la UI).
 *  - Las secciones "Top 5 productos" y "Top 5 compradores" se muestran
 *    siempre desplegadas (sin colapsable, sin icono para colapsar).
 */
import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { LazyCashFlowChart } from '../../components/dashboard/LazyCashFlowChart';
import { formatEuro } from '../../lib/format';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Color de énfasis (por defecto gris neutro; admite variantes dinámicas). */
  valueClassName?: string;
  /** Clases extra para el Card (ej: bg temático para KPIs Compras/Ventas). */
  cardClassName?: string;
}

function StatCard({ label, value, hint, valueClassName, cardClassName }: StatCardProps) {
  return (
    <Card className={cardClassName}>
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
          hint="Productos + costes de compra y de venta"
          valueClassName="dark:text-red-200 text-red-400"
        />
        <StatCard
          label="Ventas totales"
          value={formatEuro(k.ventas_total_eur)}
          hint="Ingresos brutos de las ventas"
          valueClassName="dark:text-green-200 text-green-400"
        />
        <StatCard
          label="Beneficio"
          value={`${netSign}${formatEuro(k.beneficio_total_eur)}`}
          hint="Ingresos menos los costes de cada venta"
          valueClassName={beneficioColorClass(k.beneficio_total_eur)}
        />
        <StatCard
          label="Stock pendiente"
          value={String(k.stock_pendiente_count)}
          hint={k.stock_pendiente_count > 1 ? 'Productos en el almacén' : 'Producto en el almacén'}
          valueClassName="dark:text-blue-300 text-blue-400"
        />
      </div>

      <Card>
        <CardBody>
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Flujo de caja de los últimos 12 meses
          </h3>
          <LazyCashFlowChart data={data.cashFlowByMonth} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Top 5 productos — siempre desplegado */}
        <Card>
          <CardBody>
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
              Top 5 productos
            </h3>
            {data.topProducts.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
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

        {/* Top 5 compradores — siempre desplegado */}
        <Card>
          <CardBody>
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
              Top 5 compradores
            </h3>
            {data.topBuyers.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {data.topBuyers.slice(0, 5).map((b) => (
                  <li
                    key={b.customer_id}
                    className="flex items-baseline justify-between py-2 text-sm"
                  >
                    <span className="text-gray-800 dark:text-gray-200">{b.customer_name}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">{formatEuro(b.total_gastado)}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        en {b.ventas > 1 ? `${b.ventas} ventas` : `${b.ventas} venta`}
                      </span>
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
