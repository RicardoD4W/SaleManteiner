import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatEuro } from '../../lib/format';

export interface CashFlowChartProps {
  data: Array<{
    month: string;

    ingresos: number;

    compras: number;

    beneficio: number;

    resultado: number;
  }>;
}

const SERIES_COLOR_CLASS: Record<string, string> = {
  compras: 'bg-chart-purchases',
  beneficio: 'bg-chart-sales',
  resultado: 'bg-chart-profit',
};

const MONTH_LABELS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function monthLabel(yyyymm: string): string {
  const [, month] = yyyymm.split('-');
  const m = Number(month ?? '0');
  return MONTH_LABELS[m - 1] ?? yyyymm;
}

function formatEurosShort(euros: number): string {
  if (Math.abs(euros) >= 100_000) return `${(euros / 1000).toFixed(1)}k €`;
  return `${euros.toFixed(0)} €`;
}

type CashFlowTooltipProps = Partial<TooltipContentProps<number, string>>;

function CashFlowTooltip({ active, payload, label }: CashFlowTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">
        {monthLabel(String(label))}
      </p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                SERIES_COLOR_CLASS[String(entry.dataKey)] ?? SERIES_COLOR_CLASS.beneficio,
              ].join(' ')}
              aria-hidden="true"
            />
            <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {formatEuro(Number(entry.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 w-full" data-testid="cashflow-chart">
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</p>
      </div>
    );
  }

  const yMin = Math.min(0, ...data.flatMap((d) => [d.beneficio, d.resultado]));
  const yMax = Math.max(
    1,
    ...data.flatMap((d) => [d.compras, d.ingresos, d.beneficio, d.resultado]),
  );

  return (
    <div
      className={[
        'h-64 w-full',
        '[&_.recharts-cartesian-grid-horizontal_line]:stroke-gray-200',
        'dark:[&_.recharts-cartesian-grid-horizontal_line]:stroke-gray-800',
        '[&_.recharts-cartesian-axis-line]:stroke-gray-300',
        'dark:[&_.recharts-cartesian-axis-line]:stroke-gray-700',
        '[&_.recharts-cartesian-axis-tick-line]:stroke-gray-300',
        'dark:[&_.recharts-cartesian-axis-tick-line]:stroke-gray-700',
        '[&_.recharts-cartesian-axis-tick-value]:fill-gray-500',
        'dark:[&_.recharts-cartesian-axis-tick-value]:fill-gray-400',
        '[&_.recharts-legend-item-text]:fill-gray-700',
        'dark:[&_.recharts-legend-item-text]:fill-gray-300',
      ].join(' ')}
      data-testid="cashflow-chart"
      role="img"
      aria-label="Flujo de caja por mes (compras, beneficio y resultado del mes)"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tickMargin={8} />
          <YAxis tickFormatter={formatEurosShort} domain={[yMin, yMax]} width={56} tickMargin={4} />
          <Tooltip content={<CashFlowTooltip />} />
          <Legend verticalAlign="top" align="left" height={36} />

          <Line
            type="linear"
            dataKey="compras"
            name="Compras"
            stroke="var(--color-chart-purchases)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={true}
          />
          <Line
            type="linear"
            dataKey="beneficio"
            name="Beneficio"
            stroke="var(--color-chart-sales)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={true}
          />

          <Line
            type="linear"
            dataKey="resultado"
            name="Resultado del mes"
            stroke="var(--color-chart-profit)"
            strokeWidth={2.5}
            strokeDasharray="5 4"
            dot={{ r: 2, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
