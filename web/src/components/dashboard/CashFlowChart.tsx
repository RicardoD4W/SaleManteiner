/**
 * Chart de cash flow mensual (S5 del feature dashboard-iteration-1).
 *
 * Reemplaza al antiguo RevenueChart. Muestra la línea de `neto` (compras -
 * ventas) por mes, con un área coloreada:
 *  - Bajo cero (zona de pérdida) en `bg-red-50/30` (dark `bg-red-950/20`).
 *  - Sobre cero (zona de ganancia) en `bg-emerald-50/30` (dark `bg-emerald-950/20`).
 *
 * Convención del spec: `neto = compras - ventas`. Negativo = "zona de
 * pérdida" (rojo), positivo = "zona de ganancia" (verde).
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

  // Dominio Y: el más alto entre |max| y |min| para que la línea de cero
  // quede centrada verticalmente.
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.neto)));
  const yDomain = maxAbs;

  // Posición de la línea de cero en el viewBox.
  const yAt = (v: number): number => PAD_TOP + innerH / 2 - (innerH * v) / (2 * yDomain);
  const yZero = yAt(0);
  const xAt = (i: number): number => {
    if (data.length === 1) return PAD_LEFT + innerW / 2;
    return PAD_LEFT + (innerW * i) / (data.length - 1);
  };

  const yTicks = [-1, -0.5, 0, 0.5, 1].map((f) => f * yDomain);

  // Path de la línea de neto.
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.neto).toFixed(1)}`)
    .join(' ');

  // Paths de las dos áreas (sobre cero y bajo cero). Cada área cierra con
  // la línea de cero (y=yZero) y los bordes laterales x=PAD_LEFT / x=end.
  function buildAreaPath(filter: (v: number) => boolean): string {
    const segments: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const d = data[i]!;
      const next = data[i + 1];
      if (!next) break;
      const dFilter = filter(d.neto);
      const nFilter = filter(next.neto);
      if (dFilter && nFilter) {
        // Tramo completo: linea entre los dos puntos.
        if (segments.length === 0) {
          segments.push(`M ${xAt(i).toFixed(1)} ${yZero.toFixed(1)}`);
          segments.push(`L ${xAt(i).toFixed(1)} ${yAt(d.neto).toFixed(1)}`);
        }
        segments.push(`L ${xAt(i + 1).toFixed(1)} ${yAt(next.neto).toFixed(1)}`);
      } else if (dFilter && !nFilter) {
        // Cruce de cero: interpolar el punto exacto en y=yZero.
        const ratio = (d.neto - 0) / (d.neto - next.neto);
        const crossX = xAt(i) + ratio * (xAt(i + 1) - xAt(i));
        segments.push(`L ${crossX.toFixed(1)} ${yZero.toFixed(1)}`);
        segments.push(`Z`);
      } else if (!dFilter && nFilter) {
        // Cruce inverso: arrancar nuevo subpath.
        const ratio = (next.neto - 0) / (next.neto - d.neto);
        const crossX = xAt(i) + ratio * (xAt(i + 1) - xAt(i));
        segments.push(`M ${crossX.toFixed(1)} ${yZero.toFixed(1)}`);
        segments.push(`L ${xAt(i + 1).toFixed(1)} ${yAt(next.neto).toFixed(1)}`);
      }
    }
    // Cerrar el último segmento abierto.
    if (segments.length > 0 && !segments[segments.length - 1]!.endsWith('Z')) {
      segments.push(`L ${xAt(data.length - 1).toFixed(1)} ${yZero.toFixed(1)}`);
      segments.push('Z');
    }
    return segments.join(' ');
  }

  const gainAreaPath = buildAreaPath((v) => v > 0);
  const lossAreaPath = buildAreaPath((v) => v < 0);

  return (
    <div className="h-64 w-full" data-testid="cashflow-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Cash flow por mes"
      >
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

        {/* Áreas coloreadas. fill-opacity permite que el color del tema (light/dark) mande.
            Usamos las clases Tailwind que el spec fija: bg-emerald-50/30 y bg-red-50/30 (light),
            bg-emerald-950/20 y bg-red-950/20 (dark). */}
        {gainAreaPath ? (
          <path
            d={gainAreaPath}
            fill="rgb(16 185 129 / 0.18)"
            className="dark:fill-emerald-500/15"
          />
        ) : null}
        {lossAreaPath ? (
          <path
            d={lossAreaPath}
            fill="rgb(239 68 68 / 0.18)"
            className="dark:fill-red-500/15"
          />
        ) : null}

        {/* Línea de neto. */}
        <path
          d={linePath}
          stroke="#10b981"
          className="dark:stroke-emerald-400"
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Puntos por mes. */}
        {data.map((d, i) => (
          <circle
            key={`pt-${i}`}
            cx={xAt(i)}
            cy={yAt(d.neto)}
            r={3}
            fill="#ffffff"
            stroke="#10b981"
            className="dark:fill-gray-900 dark:stroke-emerald-400"
            strokeWidth={2}
          />
        ))}

        {/* Leyenda. */}
        <g transform={`translate(${PAD_LEFT + 8} ${PAD_TOP + 8})`}>
          <rect width="12" height="3" y="6" fill="#10b981" className="dark:fill-emerald-400" />
          <text x="18" y="9" fontSize={11} fill="#374151" className="dark:fill-gray-300">
            Neto (compras − ventas)
          </text>
        </g>
      </svg>
    </div>
  );
}
