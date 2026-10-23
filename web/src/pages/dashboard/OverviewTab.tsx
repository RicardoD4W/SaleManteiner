import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { Card, CardBody } from '../../components/ui/Card';
import { StatCard, profitColorClass } from '../../components/dashboard/StatCard';
import { Spinner } from '../../components/ui/Spinner';
import { LazyCashFlowChart } from '../../components/dashboard/LazyCashFlowChart';
import { formatEuro } from '../../lib/format';
import { ErrorState } from '../../components/ui/ErrorState';

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
          <ErrorState
            message={`No se pudo cargar el dashboard: ${error.message}`}
            onRetry={() => refetch()}
          />
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
          valueClassName="dark:text-emerald-300 text-emerald-800"
        />
        <StatCard
          label="Beneficio"
          value={`${netSign}${formatEuro(k.beneficio_total_eur)}`}
          hint="Ingresos menos los costes de cada venta"
          valueClassName={profitColorClass(k.beneficio_total_eur)}
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
                    key={p.product_id}
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
