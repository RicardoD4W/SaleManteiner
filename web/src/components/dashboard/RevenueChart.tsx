import type { RevenueByMonth } from '../../api/sales.js';

/**
 * Línea de revenue mensual + profit (Fase 5 / S7).
 *
 * Implementación con SVG inline en lugar de `recharts`. Razón: recharts v3
 * tira runtime error en React 19 strict (sus types compilan pero su runtime
 * usa patterns incompatibles). SVG manual es ~80 líneas, sin deps externas
 * y exactamente lo que necesita el dashboard (no necesitamos zoom, brush, ni
 * tooltips interactivos complejos). Migrar a recharts de nuevo cuando
 * estabilicen el soporte para React 19.
 *
 * Diseño:
 *  - viewBox fijo 800x240 (ResponsiveContainer via CSS scale).
 *  - Línea verde (`Ingresos`) y azul punteada (`Beneficio`).
 *  - Eje X: 12 labels `ene`..`dic`.
 *  - Eje Y: ticks redondeados en céntimos→euros.
 *  - Datos en céntimos (entero) — los formateos a euros viven SOLO en los ticks/tooltip.
 */
interface Props {
  data: RevenueByMonth[];
}

const VIEW_W = 800;
const VIEW_H = 240;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

const MONTH_LABELS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function monthLabel(yyyymm: string): string {
  const m = Number(yyyymm.split('-')[1] ?? '0');
  return MONTH_LABELS[m - 1] ?? yyyymm;
}

function formatEurosShort(cents: number): string {
  if (cents >= 100_000) return `${(cents / 100_000).toFixed(1)}k €`;
  return `${(cents / 100).toFixed(0)} €`;
}

export function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 w-full" data-testid="revenue-chart">
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</p>
      </div>
    );
  }

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(
    1,
    ...data.map((d) => Math.max(d.revenue_cents, d.profit_cents)),
  );

  // Y axis: 5 ticks (0, 25%, 50%, 75%, 100%).
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);
  function xAt(i: number): number {
    if (data.length === 1) return PAD_LEFT + innerW / 2;
    return PAD_LEFT + (innerW * i) / (data.length - 1);
  }
  function yAt(v: number): number {
    return PAD_TOP + innerH - (innerH * v) / maxValue;
  }

  const pathFor = (key: 'revenue_cents' | 'profit_cents'): string =>
    data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d[key]).toFixed(1)}`)
      .join(' ');

  return (
    <div className="h-64 w-full" data-testid="revenue-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Ingresos por mes"
      >
        {/* Grid horizontal */}
        {yTicks.map((t, i) => (
          <line
            key={`yt-${i}`}
            x1={PAD_LEFT}
            x2={VIEW_W - PAD_RIGHT}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="#e5e7eb"
            className="dark:stroke-gray-800"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={`ytl-${i}`}
            x={PAD_LEFT - 8}
            y={yAt(t) + 3}
            textAnchor="end"
            fontSize={11}
            fill="#6b7280"
            className="dark:fill-gray-400"
          >
            {formatEurosShort(t)}
          </text>
        ))}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={`xl-${i}`}
            x={xAt(i)}
            y={VIEW_H - 12}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
            className="dark:fill-gray-400"
          >
            {monthLabel(d.month)}
          </text>
        ))}

        {/* Revenue (verde, sólido) */}
        <path
          d={pathFor('revenue_cents')}
          stroke="#22c55e"
          className="dark:stroke-brand-400"
          strokeWidth={2}
          fill="none"
        />
        {/* Profit (azul, punteado) */}
        <path
          d={pathFor('profit_cents')}
          stroke="#3b82f6"
          strokeWidth={2}
          fill="none"
          strokeDasharray="4 4"
          className="dark:stroke-blue-400"
        />

        {/* Leyenda */}
        <g transform={`translate(${PAD_LEFT + 8} ${PAD_TOP + 8})`}>
          <rect width="12" height="3" y="6" fill="#22c55e" className="dark:fill-brand-400" />
          <text x="18" y="9" fontSize={11} fill="#374151" className="dark:fill-gray-300">
            Ingresos
          </text>
          <rect width="12" height="3" y="22" fill="#3b82f6" className="dark:fill-blue-400" />
          <text x="18" y="25" fontSize={11} fill="#374151" className="dark:fill-gray-300">
            Beneficio
          </text>
        </g>
      </svg>
    </div>
  );
}
