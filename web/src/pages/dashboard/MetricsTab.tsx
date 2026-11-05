import { useStatsMetrics } from '../../hooks/useStatsMetrics';
import { Card, CardBody } from '../../components/ui/Card';
import { StatCard } from '../../components/dashboard/StatCard';
import { METRIC_COLOR, profitColorClass, variationColorClass } from '../../lib/colors';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import {
  formatEuro,
  formatMonth,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from '../../lib/format';

export function MetricsTab() {
  const { data, isLoading, isError, error, refetch } = useStatsMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando métricas…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardBody>
          <ErrorState
            message={`No se pudieron cargar las métricas: ${error.message}`}
            onRetry={() => refetch()}
          />
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const k = data.kpis;
  const actual = data.mes_actual;
  const anterior = data.mes_anterior;
  const var_ = data.variaciones;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Este mes ({formatMonth(actual.month)})
        </h3>
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          data-testid="metrics-mes-kpis"
        >
          <StatCard
            label="Ingresos"
            value={formatEuro(actual.ingresos)}
            hint={`${actual.ventas} ${actual.ventas === 1 ? 'venta' : 'ventas'}`}
          />
          <StatCard
            label="Beneficio"
            value={formatEuro(actual.beneficio)}
            hint="Ingresos menos los costes de cada venta"
            valueClassName={profitColorClass(actual.beneficio)}
          />
          <StatCard
            label="Gastos"
            value={formatEuro(actual.gastos)}
            hint="Gastos generales del mes"
            valueClassName={METRIC_COLOR.gastos}
          />
          <StatCard
            label="Beneficio neto"
            value={formatEuro(actual.resultado)}
            hint="Beneficio menos gastos"
            valueClassName={profitColorClass(actual.resultado)}
          />
          <StatCard
            label="Margen"
            value={formatPercent(actual.margen_pct)}
            hint="Beneficio sobre ingresos"
            valueClassName={profitColorClass(actual.margen_pct)}
          />
          <StatCard label="Ventas" value={String(actual.ventas)} hint="Ventas cerradas en el mes" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
          Frente a {formatMonth(anterior.month)}
        </h3>
        {var_ === null ? (
          <Card>
            <CardBody>
              <p
                className="text-sm text-gray-500 dark:text-gray-400"
                data-testid="metrics-sin-base"
              >
                El mes anterior no tuvo actividad: no hay con qué comparar este mes.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
            data-testid="metrics-variaciones"
          >
            <StatCard
              label="Ingresos"
              value={var_.ingresos_pct === null ? '—' : formatSignedPercent(var_.ingresos_pct)}
              hint="Variación de ingresos"
              valueClassName={variationColorClass(var_.ingresos_pct)}
            />
            <StatCard
              label="Beneficio"
              value={var_.beneficio_pct === null ? '—' : formatSignedPercent(var_.beneficio_pct)}
              hint="Variación de beneficio"
              valueClassName={variationColorClass(var_.beneficio_pct)}
            />
            <StatCard
              label="Gastos"
              value={var_.gastos_pct === null ? '—' : formatSignedPercent(var_.gastos_pct)}
              hint="Variación de gastos"
              valueClassName={variationColorClass(var_.gastos_pct, true)}
            />
            <StatCard
              label="Beneficio neto"
              value={var_.resultado_pct === null ? '—' : formatSignedPercent(var_.resultado_pct)}
              hint="Variación del resultado"
              valueClassName={variationColorClass(var_.resultado_pct)}
            />
            <StatCard
              label="Margen"
              value={var_.margen_puntos === null ? '—' : formatSignedPoints(var_.margen_puntos)}
              hint="Variación en puntos porcentuales"
              valueClassName={variationColorClass(var_.margen_puntos)}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Globales</h3>
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          data-testid="metrics-kpis"
        >
          <StatCard
            label="Ingresos totales"
            value={formatEuro(k.ingresos_total_eur)}
            hint="Suma de todas las ventas"
          />
          <StatCard
            label="Beneficio total"
            value={formatEuro(k.beneficio_total_eur)}
            hint="Ingresos menos todos los costes"
            valueClassName={profitColorClass(k.beneficio_total_eur)}
          />
          <StatCard
            label="Margen global"
            value={formatPercent(k.margen_pct)}
            hint="Beneficio sobre ingresos"
            valueClassName={profitColorClass(k.margen_pct)}
          />
          <StatCard
            label="Gastos sobre ingresos"
            value={formatPercent(k.gastos_sobre_ingresos_pct)}
            hint="Peso de los gastos en la facturación"
            valueClassName={METRIC_COLOR.gastos}
          />
          <StatCard
            label="Ticket medio"
            value={formatEuro(k.ticket_medio_eur)}
            hint="Ingresos por venta"
          />
          <StatCard
            label="Beneficio medio"
            value={formatEuro(k.beneficio_medio_venta_eur)}
            hint="Beneficio por venta"
            valueClassName={profitColorClass(k.beneficio_medio_venta_eur)}
          />
          <StatCard
            label="Deuda total"
            value={formatEuro(k.deuda_total_eur)}
            hint="Cobrado pendiente de los clientes"
            valueClassName={METRIC_COLOR.deuda}
          />
          <StatCard
            label="Clientes con deuda"
            value={String(k.clientes_con_deuda)}
            hint={`${k.clientes_count} ${k.clientes_count === 1 ? 'cliente' : 'clientes'}`}
            valueClassName={METRIC_COLOR.deuda}
          />
          <StatCard
            label="Valor del stock"
            value={formatEuro(k.stock_coste_total_eur)}
            hint={`Coste de ${k.stock_pendiente_count} ${
              k.stock_pendiente_count === 1 ? 'producto pendiente' : 'productos pendientes'
            }`}
            valueClassName={METRIC_COLOR.stock}
          />
          <StatCard
            label="Ventas"
            value={String(k.ventas_count)}
            hint="Ventas registradas en total"
          />
          <StatCard
            label="Beneficio neto"
            value={formatEuro(k.beneficio_neto_eur)}
            hint="Beneficio total menos gastos"
            valueClassName={profitColorClass(k.beneficio_neto_eur)}
          />
          <StatCard
            label="Gastos totales"
            value={formatEuro(k.gastos_total_eur)}
            hint="Gastos generales registrados"
            valueClassName={METRIC_COLOR.gastos}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardBody>
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
              Márgenes por producto
            </h3>
            {data.margen_productos.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sin ventas todavía.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {data.margen_productos.map((p) => (
                  <li
                    key={p.product_id}
                    className="flex items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span className="truncate text-gray-800 dark:text-gray-200">
                      {p.product_name}
                    </span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {formatPercent(p.margen_pct)}
                      <span className="ml-2 text-xs text-gray-400">
                        {formatEuro(p.beneficio)} · {p.unidades}×
                      </span>
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
              Clientes con deuda
            </h3>
            {data.deudores.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nadie te debe dinero.</p>
            ) : (
              <ul
                className="mt-2 divide-y divide-gray-100 dark:divide-gray-800"
                data-testid="metrics-deudores"
              >
                {data.deudores.map((c) => (
                  <li
                    key={c.customer_id}
                    className="flex items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span className="truncate text-gray-800 dark:text-gray-200">
                      {c.customer_name}
                    </span>
                    <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                      {formatEuro(c.deuda)}
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
              Gastos por categoría
            </h3>
            {data.gastos_categoria.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Sin gastos registrados.
              </p>
            ) : (
              <ul
                className="mt-2 divide-y divide-gray-100 dark:divide-gray-800"
                data-testid="metrics-gastos-categoria"
              >
                {data.gastos_categoria.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span className="truncate text-gray-800 dark:text-gray-200">{c.name}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {formatEuro(c.total)}
                      <span className="ml-2 text-xs text-gray-400">{formatPercent(c.pct)}</span>
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
