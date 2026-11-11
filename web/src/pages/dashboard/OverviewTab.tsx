import { useMemo } from 'react';
import { useStatsDashboard } from '../../hooks/useStatsDashboard';
import { useAnimatedRows } from '../../hooks/useAnimatedRows';
import { Card, CardBody } from '../../components/ui/Card';
import { StatCard } from '../../components/dashboard/StatCard';
import { METRIC_COLOR, profitColorClass } from '../../lib/colors';
import { Spinner } from '../../components/ui/Spinner';
import { LazyCashFlowChart } from '../../components/dashboard/LazyCashFlowChart';
import { formatEuro } from '../../lib/format';
import { ErrorState } from '../../components/ui/ErrorState';
import { cn } from '../../lib/classNames';

export function OverviewTab() {
  const { data, isLoading, isError, error, refetch } = useStatsDashboard();

  const topProducts = useMemo(
    () =>
      (data?.topProducts ?? [])
        .slice(0, 5)
        .map((product) => ({ ...product, id: product.product_id })),
    [data],
  );

  const topBuyers = useMemo(
    () => (data?.topBuyers ?? []).slice(0, 5).map((buyer) => ({ ...buyer, id: buyer.customer_id })),
    [data],
  );

  const {
    rows: productRows,
    rowClassName: productClassName,
    rowKey: productKey,
  } = useAnimatedRows(topProducts);

  const {
    rows: buyerRows,
    rowClassName: buyerClassName,
    rowKey: buyerKey,
  } = useAnimatedRows(topBuyers);

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
  const netProfitSign = k.beneficio_neto_eur >= 0 ? '+' : '';

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
        data-testid="overview-kpis"
      >
        <StatCard
          label="Compras totales"
          value={formatEuro(k.compras_total_eur)}
          hint="Productos + costes de compra y de venta"
          valueClassName={METRIC_COLOR.compras}
        />
        <StatCard
          label="Ventas totales"
          value={formatEuro(k.ventas_total_eur)}
          hint="Ingresos brutos de las ventas"
        />
        <StatCard
          label="Beneficio"
          value={`${netSign}${formatEuro(k.beneficio_total_eur)}`}
          hint="Ingresos menos los costes de cada venta"
          valueClassName={profitColorClass(k.beneficio_total_eur)}
        />
        <StatCard
          label="Gastos"
          value={formatEuro(k.gastos_total_eur)}
          hint="Gastos generales del periodo"
          valueClassName={METRIC_COLOR.gastos}
        />
        <StatCard
          label="Beneficio neto"
          value={`${netProfitSign}${formatEuro(k.beneficio_neto_eur)}`}
          hint="Beneficio de ventas menos gastos"
          valueClassName={profitColorClass(k.beneficio_neto_eur)}
        />
        <StatCard
          label="Stock pendiente"
          value={String(k.stock_pendiente_count)}
          hint={k.stock_pendiente_count > 1 ? 'Productos en el almacén' : 'Producto en el almacén'}
          valueClassName={METRIC_COLOR.stock}
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
            {productRows.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {productRows.map((p) => (
                  <li
                    key={productKey(p.id)}
                    className={cn(
                      'flex items-baseline justify-between py-2 text-sm',
                      productClassName(p.id),
                    )}
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
            {buyerRows.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {buyerRows.map((b) => (
                  <li
                    key={buyerKey(b.id)}
                    className={cn(
                      'flex items-baseline justify-between py-2 text-sm',
                      buyerClassName(b.id),
                    )}
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
