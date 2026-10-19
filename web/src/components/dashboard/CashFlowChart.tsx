/**
 * Chart de flujo de caja mensual (reemplaza al antiguo cash-flow de neto).
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
 * SVG inline (mismo motivo que el antiguo RevenueChart: evitar la dependencia
 * de recharts para una serie de 12 puntos).
 *
 * Importes en EUROS.
 */
interface Props {
  data: Array<{ month: string; compras: number; ventas: number; neto: number }>;
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

function formatEurosShort(euros: number): string {
  if (Math.abs(euros) >= 100_000) return `${(euros / 1000).toFixed(1)}k €`;
  return `${euros.toFixed(0)} €`;
}

export function CashFlowChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 w-full" data-testid="cashflow-chart">
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos.</p>
      </div>
    );
  }

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  // Dominio Y: incluye el cero siempre, y se extiende hacia abajo si hay
  // ventas negativas (profit < 0 cuando se vendió por debajo del COGS) y
  // hacia arriba para el máximo de compras. Línea de cero siempre visible
  // como referencia; el rango se ajusta dinámicamente.
  const yMin = Math.min(0, ...data.map((d) => d.ventas));
  const yMax = Math.max(1, ...data.map((d) => d.compras));
  const yDomain = yMax - yMin;

  // Posición Y de un valor: el cero queda en PAD_BOTTOM si yMin === 0,
  // o más arriba (proporcional) si yMin < 0. El máximo se eleva.
  const yAt = (v: number): number =>
    PAD_BOTTOM - (innerH * (v - yMin)) / yDomain;

  const xAt = (i: number): number => {
    if (data.length === 1) return PAD_LEFT + innerW / 2;
    return PAD_LEFT + (innerW * i) / (data.length - 1);
  };

  // Ticks del eje Y: 0, 0.25, 0.5, 0.75, 1 (en fracciones de yDomain).
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yDomain);

  // Paths de las dos series.
  const comprasPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.compras).toFixed(1)}`)
    .join(' ');
  const ventasPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.ventas).toFixed(1)}`)
    .join(' ');

  return (
    <div className="h-64 w-full" data-testid="cashflow-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Flujo de caja por mes (compras vs ventas)"
      >
        {/* Grid horizontal + línea base (y=0). */}
        {yTicks.map((t, i) => (
          <line
            key={`yt-${i}`}
            x1={PAD_LEFT}
            x2={VIEW_W - PAD_RIGHT}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="#e5e7eb"
            className="dark:stroke-gray-800"
            strokeDasharray={t === 0 ? '0' : '3 3'}
            strokeWidth={t === 0 ? 1.5 : 1}
          />
        ))}

        {/* Etiquetas del eje Y. */}
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

        {/* Etiquetas del eje X (meses). */}
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

        {/* Línea de COMPRAS (rojo/naranja: gasto). */}
        <path
          d={comprasPath}
          stroke="#ef4444"
          className="dark:stroke-red-400"
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Puntos de COMPRAS. */}
        {data.map((d, i) => (
          <circle
            key={`ptc-${i}`}
            cx={xAt(i)}
            cy={yAt(d.compras)}
            r={3}
            fill="#ffffff"
            stroke="#ef4444"
            className="dark:fill-gray-900 dark:stroke-red-400"
            strokeWidth={2}
          />
        ))}

        {/* Línea de VENTAS (verde: ingreso). */}
        <path
          d={ventasPath}
          stroke="#10b981"
          className="dark:stroke-emerald-400"
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Puntos de VENTAS. */}
        {data.map((d, i) => (
          <circle
            key={`ptv-${i}`}
            cx={xAt(i)}
            cy={yAt(d.ventas)}
            r={3}
            fill="#ffffff"
            stroke="#10b981"
            className="dark:fill-gray-900 dark:stroke-emerald-400"
            strokeWidth={2}
          />
        ))}

        {/* Leyenda: Compras (rojo) + Ventas (verde). */}
        <g transform={`translate(${PAD_LEFT + 8} ${PAD_TOP + 8})`}>
          {/* Compras */}
          <rect
            width="12"
            height="3"
            y="2"
            fill="#ef4444"
            className="dark:fill-red-400"
          />
          <text x="18" y="9" fontSize={11} fill="#374151" className="dark:fill-gray-300">
            Compras (gastos)
          </text>
          {/* Ventas */}
          <rect
            width="12"
            height="3"
            y="16"
            fill="#10b981"
            className="dark:fill-emerald-400"
          />
          <text x="18" y="23" fontSize={11} fill="#374151" className="dark:fill-gray-300">
            Ventas (ingresos)
          </text>
        </g>
      </svg>
    </div>
  );
}