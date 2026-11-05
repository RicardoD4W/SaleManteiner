import type { CSSProperties } from 'react';
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
import { METRIC_CHART_COLOR, METRIC_DOT_COLOR } from '../../lib/colors';
import { useChartSeriesVisibility } from '../../hooks/useChartSeriesVisibility';

export interface CashFlowChartProps {
  data: Array<{
    month: string;

    ingresos: number;

    compras: number;

    gastos?: number;

    beneficio: number;

    resultado: number;
  }>;
}

const CHART_ID = 'cashflow';

type SeriesKey = 'compras' | 'gastos' | 'beneficio' | 'resultado';

interface CashFlowSeries {
  key: SeriesKey;
  name: string;
  color: string;
  strokeDasharray?: string;
  dotRadius: number;
}

const CASH_FLOW_SERIES: CashFlowSeries[] = [
  { key: 'compras', name: 'Compras', color: METRIC_CHART_COLOR.compras, dotRadius: 3 },
  {
    key: 'gastos',
    name: 'Gastos',
    color: METRIC_CHART_COLOR.gastos,
    strokeDasharray: '2 3',
    dotRadius: 3,
  },
  { key: 'beneficio', name: 'Beneficio', color: METRIC_CHART_COLOR.beneficio, dotRadius: 3 },
  {
    key: 'resultado',
    name: 'Resultado del mes',
    color: METRIC_CHART_COLOR.resultado,
    strokeDasharray: '5 4',
    dotRadius: 2,
  },
];

const SERIES_KEYS = CASH_FLOW_SERIES.map((series) => series.key);

const SERIES_COLOR_CLASS: Record<string, string> = {
  compras: METRIC_DOT_COLOR.compras,
  gastos: METRIC_DOT_COLOR.gastos,
  beneficio: METRIC_DOT_COLOR.beneficio,
  resultado: METRIC_DOT_COLOR.resultado,
};

const LEGEND_LINE_HEIGHT = 18;
const LEGEND_LINES = 3;
const LEGEND_HEIGHT = LEGEND_LINE_HEIGHT * LEGEND_LINES;

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

type CashFlowTooltipProps = Partial<TooltipContentProps<number, string>> & {
  hiddenSeries?: ReadonlySet<string>;
};

function CashFlowTooltip({ active, payload, label, hiddenSeries }: CashFlowTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const visiblePayload = payload.filter((entry) => !hiddenSeries?.has(String(entry.dataKey)));
  if (visiblePayload.length === 0) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">
        {monthLabel(String(label))}
      </p>
      <ul className="space-y-0.5">
        {visiblePayload.map((entry) => (
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

interface CashFlowLegendProps {
  hiddenSeries: ReadonlySet<string>;
  onToggle: (seriesKey: string) => void;
}

function seriesSwatchStyle(series: CashFlowSeries): CSSProperties {
  if (!series.strokeDasharray) {
    return { backgroundColor: series.color };
  }
  return {
    backgroundImage: `repeating-linear-gradient(90deg, ${series.color} 0 4px, transparent 4px 7px)`,
  };
}

function CashFlowLegend({ hiddenSeries, onToggle }: CashFlowLegendProps) {
  return (
    <ul className="recharts-default-legend" style={{ padding: 0, margin: 0, textAlign: 'left' }}>
      {CASH_FLOW_SERIES.map((series) => {
        const isHidden = hiddenSeries.has(series.key);
        return (
          <li
            key={series.key}
            className="recharts-legend-item"
            style={{ display: 'inline-block', marginRight: 10, whiteSpace: 'nowrap' }}
          >
            <button
              type="button"
              onClick={() => onToggle(series.key)}
              aria-pressed={!isHidden}
              data-testid={`legend-toggle-${series.key}`}
              className={[
                'flex cursor-pointer items-center gap-1 rounded leading-[18px]',
                isHidden ? 'opacity-50 line-through' : 'opacity-100',
              ].join(' ')}
              style={{ color: series.color }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-[3px] w-4 shrink-0 rounded-full"
                style={seriesSwatchStyle(series)}
              />
              <span className="recharts-legend-item-text">{series.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const { hiddenSeries, toggleSeries } = useChartSeriesVisibility(CHART_ID, SERIES_KEYS);

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
    ...data.flatMap((d) => [d.compras, d.ingresos, d.gastos ?? 0, d.beneficio, d.resultado]),
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
      role="group"
      aria-label="Flujo de caja por mes (compras, gastos, beneficio y resultado del mes)"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tickMargin={8} />
          <YAxis tickFormatter={formatEurosShort} domain={[yMin, yMax]} width={56} tickMargin={4} />
          <Tooltip content={<CashFlowTooltip hiddenSeries={hiddenSeries} />} />
          <Legend
            verticalAlign="top"
            align="left"
            height={LEGEND_HEIGHT}
            wrapperStyle={{ fontSize: 12, lineHeight: '18px' }}
            content={<CashFlowLegend hiddenSeries={hiddenSeries} onToggle={toggleSeries} />}
          />

          {CASH_FLOW_SERIES.map((series) => (
            <Line
              key={series.key}
              type="linear"
              dataKey={series.key}
              name={series.name}
              stroke={series.color}
              strokeWidth={2.5}
              strokeDasharray={series.strokeDasharray}
              dot={{ r: series.dotRadius, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
              hide={hiddenSeries.has(series.key)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
