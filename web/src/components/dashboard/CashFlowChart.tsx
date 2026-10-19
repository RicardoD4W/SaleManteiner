/**
 * Chart de flujo de caja mensual (recharts).
 *
 * Muestra **dos series separadas** por mes:
 *  - **Compras** (lo que gasté): inversión del mes = SUM(buys.purchase_cost
 *    + buys.associated_costs) + SUM(solds.associated_costs).
 *  - **Ventas** (lo que generé): profit realizado por las ventas del mes
 *    (sale_price - associated_costs - COGS prorrateado - buy.assoc
 *    prorrateado, fórmula S13 del feature buys-and-solds).
 *
 * Decisión del feature phase-8-polish-e2e-docs: el chart anterior mostraba
 * una sola línea de `neto = compras - ventas`. Cuando el negocio estaba
 * cerca del punto de equilibrio (compras ≈ ventas), la línea quedaba casi
 * pegada al eje cero y daba la sensación de que "no había datos". El
 * rediseño a dos series separadas hace visible el flujo real: incluso si
 * neto ≈ 0, las dos líneas muestran cuánto entró y cuánto salió.
 *
 * Implementado con **recharts** (feature `recharts-charts`): antes era SVG
 * inline, que obligaba a mantener a mano el dominio, los ticks y las
 * escalas. El dominio del eje Y se sigue calculando a mano (no交给 recharts)
 * para garantizar que el cero esté siempre visible y que las ventas
 * negativas (profit < 0) no se salgan del área de dibujo.
 *
 * Theming: recharts escribe atributos `stroke`/`fill` en el SVG que
 * genera, así que el dark mode se resuelve con variables CSS
 * (`--color-chart-*` en `index.css`) y con variantes arbitrarias de
 * Tailwind 4 sobre los elementos internos de recharts.
 *
 * Importes en EUROS.
 */
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

interface Props {
  data: Array<{ month: string; compras: number; ventas: number; neto: number }>;
}

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
  const m = Number(yyyymm.split('-')[1] ?? '0');
  return MONTH_LABELS[m - 1] ?? yyyymm;
}

function formatEurosShort(euros: number): string {
  if (Math.abs(euros) >= 100_000) return `${(euros / 1000).toFixed(1)}k €`;
  return `${euros.toFixed(0)} €`;
}

/** Tooltip propio: recharts no se puede tematizar por clases, y el default
 *  trae fondo blanco (ilegible en dark mode).
 *
 *  Los props van como `Partial` porque recharts los inyecta al renderizar
 *  (y `TooltipContentProps` los declara obligatorios, lo que impide pasar el
 *  componente como elemento vacío). */
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
                entry.dataKey === 'compras'
                  ? 'bg-[var(--color-chart-compras)]'
                  : 'bg-[var(--color-chart-ventas)]',
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

export function CashFlowChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 w-full" data-testid="cashflow-chart">
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</p>
      </div>
    );
  }

  // Dominio Y: incluye el cero siempre, y se extiende hacia abajo si hay
  // ventas negativas (profit < 0 cuando se vendió por debajo del COGS) y
  // hacia arriba para el máximo de compras.
  const yMin = Math.min(0, ...data.map((d) => d.ventas));
  const yMax = Math.max(1, ...data.map((d) => d.compras));

  return (
    <div
      className={[
        'h-64 w-full',
        // Grid y ejes: gris claro en light, gris oscuro en dark.
        '[&_.recharts-cartesian-grid-horizontal_line]:stroke-gray-200',
        'dark:[&_.recharts-cartesian-grid-horizontal_line]:stroke-gray-800',
        '[&_.recharts-cartesian-axis-line]:stroke-gray-300',
        'dark:[&_.recharts-cartesian-axis-line]:stroke-gray-700',
        '[&_.recharts-cartesian-axis-tick-line]:stroke-gray-300',
        'dark:[&_.recharts-cartesian-axis-tick-line]:stroke-gray-700',
        '[&_.recharts-cartesian-axis-tick-value]:fill-gray-500',
        'dark:[&_.recharts-cartesian-axis-tick-value]:fill-gray-400',
        // Leyenda.
        '[&_.recharts-legend-item-text]:fill-gray-700',
        'dark:[&_.recharts-legend-item-text]:fill-gray-300',
      ].join(' ')}
      data-testid="cashflow-chart"
      role="img"
      aria-label="Flujo de caja por mes (compras vs ventas)"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tickMargin={8} />
          <YAxis tickFormatter={formatEurosShort} domain={[yMin, yMax]} width={56} tickMargin={4} />
          <Tooltip content={<CashFlowTooltip />} />
          <Legend verticalAlign="top" align="left" height={24} />
          <Line
            type="linear"
            dataKey="compras"
            name="Compras (gastos)"
            stroke="var(--color-chart-compras)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="ventas"
            name="Ventas (ingresos)"
            stroke="var(--color-chart-ventas)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--color-chart-dot)', strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
