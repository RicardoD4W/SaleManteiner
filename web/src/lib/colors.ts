export const METRIC_COLOR = {
  compras: 'text-metric-compras',
  gastos: 'text-metric-gastos',
  beneficio: 'text-metric-beneficio',
  resultado: 'text-metric-resultado',
  stock: 'text-metric-stock',
  deuda: 'text-metric-deuda',
  perdida: 'text-metric-perdida',
} as const;

export const METRIC_DOT_COLOR = {
  compras: 'bg-metric-compras',
  gastos: 'bg-metric-gastos',
  beneficio: 'bg-metric-beneficio',
  resultado: 'bg-metric-resultado',
} as const;

export const METRIC_CHART_COLOR = {
  compras: 'var(--color-metric-compras)',
  gastos: 'var(--color-metric-gastos)',
  beneficio: 'var(--color-metric-beneficio)',
  resultado: 'var(--color-metric-resultado)',
} as const;

export const NEUTRAL_VALUE_COLOR = 'text-gray-600 dark:text-gray-400';

export function profitColorClass(value: number): string {
  if (value < 0) return METRIC_COLOR.perdida;
  if (value === 0) return NEUTRAL_VALUE_COLOR;
  return METRIC_COLOR.beneficio;
}

export function variationColorClass(value: number | null, inverse = false): string {
  if (value === null || value === 0) return NEUTRAL_VALUE_COLOR;
  const positive = inverse ? value < 0 : value > 0;
  return positive ? METRIC_COLOR.beneficio : METRIC_COLOR.perdida;
}
