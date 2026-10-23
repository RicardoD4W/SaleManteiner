import { Suspense, lazy } from 'react';
import { Spinner } from '../ui/Spinner';
import type { CashFlowChartProps } from './CashFlowChart';

const CashFlowChart = lazy(async () => {
  const mod = await import('./CashFlowChart');
  return { default: mod.CashFlowChart };
});

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

export function LazyCashFlowChart(props: CashFlowChartProps) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <CashFlowChart {...props} />
    </Suspense>
  );
}
