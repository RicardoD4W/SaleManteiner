/**
 * Boundary lazy del CashFlowChart.
 *
 * `recharts` pesa ~400KB (bundle) y el chart es lo más caro de pintar del
 * dashboard (~200ms de render en dev, medido con CDP Profiler). Con
 * `React.lazy` el módulo del chart (y con él `recharts`) sale del chunk
 * inicial: se pide **en paralelo** al fetch de `/api/stats/dashboard` y su
 * render cae en un tick propio del scheduler, en vez de inflar el render
 * inicial de la app.
 *
 * Regla aplicada: skill `react-best-practices` → `bundle-dynamic-imports`
 * (lazy-load de componentes pesados que no hacen falta en el primer render).
 *
 * El `Suspense` vive **dentro** de este wrapper a propósito: cada consumidor
 * (`OverviewTab`, `RevenueTab`) usa el chart igual y no tiene que repetir ni
 * el boundary ni el fallback. Si mañana aparece un tercer consumidor, no
 * puede olvidarse del `Suspense`.
 */
import { Suspense, lazy } from 'react';
import { Spinner } from '../ui/Spinner';
import type { CashFlowChartProps } from './CashFlowChart';

const CashFlowChart = lazy(async () => {
  const mod = await import('./CashFlowChart');
  return { default: mod.CashFlowChart };
});

/**
 * Fallback mientras se descarga el módulo del chart.
 *
 * - Mismo alto que el chart real (`h-64`) para no saltar el layout.
 * - `role="status"`: la región viva anuncia el estado de carga a lectores
 *   de pantalla (WCAG 4.1.3).
 * - El spinner es decorativo (`aria-hidden`): el texto ya dice "Cargando".
 */
function ChartFallback() {
  return (
    <div
      className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400"
      data-testid="cashflow-chart-fallback"
      role="status"
    >
      <span aria-hidden="true">
        <Spinner size="sm" />
      </span>
      Cargando gráfico…
    </div>
  );
}

/**
 * Versión lazy del `CashFlowChart`, con `Suspense` incluido.
 *
 * API idéntica al componente real: los consumidores no cambian de contrato,
 * solo el momento en que aparece el chart.
 */
export function LazyCashFlowChart(props: CashFlowChartProps) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <CashFlowChart {...props} />
    </Suspense>
  );
}
