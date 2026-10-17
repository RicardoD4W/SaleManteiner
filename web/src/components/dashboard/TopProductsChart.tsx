import type { TopProduct } from '../../api/sales.js';

/**
 * Bar chart horizontal con top productos por revenue (Fase 5 / S8).
 *
 * SVG manual (ver RevenueChart para la razón). Mismo look que recharts
 * hubiera dado, sin el problema de runtime con React 19 strict.
 */
interface Props {
  data: TopProduct[];
}

const VIEW_W = 800;
const BAR_H = 22;
const BAR_GAP = 8;
const PAD_LEFT = 160; // ancho reservado para nombres
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;

function truncate(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatEurosShort(cents: number): string {
  if (cents >= 100_000) return `${(cents / 100_000).toFixed(1)}k €`;
  return `${(cents / 100).toFixed(0)} €`;
}

export function TopProductsChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-72 w-full" data-testid="top-products-chart">
        <p className="text-sm text-gray-500">Sin datos.</p>
      </div>
    );
  }

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const maxRevenue = Math.max(1, ...data.map((d) => d.total_revenue_cents));
  const totalH = data.length * (BAR_H + BAR_GAP) - BAR_GAP + PAD_TOP + PAD_BOTTOM;
  const viewH = Math.max(VIEW_W * 0.5, totalH);

  return (
    <div className="h-72 w-full" data-testid="top-products-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Top productos por revenue"
      >
        {/* Eje X ticks (4 levels) */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const x = PAD_LEFT + innerW * f;
          return (
            <g key={`xt-${i}`}>
              <line x1={x} x2={x} y1={PAD_TOP} y2={viewH - PAD_BOTTOM} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text
                x={x}
                y={viewH - 4}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {formatEurosShort(maxRevenue * f)}
              </text>
            </g>
          );
        })}

        {/* Barras */}
        {data.map((d, i) => {
          const y = PAD_TOP + i * (BAR_H + BAR_GAP);
          const w = Math.max(2, (innerW * d.total_revenue_cents) / maxRevenue);
          const x = PAD_LEFT;
          return (
            <g key={d.product_name}>
              <text
                x={PAD_LEFT - 8}
                y={y + BAR_H / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fill="#374151"
              >
                {truncate(d.product_name)}
              </text>
              <rect
                x={x}
                y={y}
                width={w}
                height={BAR_H}
                rx={2}
                ry={2}
                fill="#22c55e"
              />
              <text
                x={x + w + 6}
                y={y + BAR_H / 2 + 4}
                fontSize={11}
                fill="#374151"
              >
                {formatEurosShort(d.total_revenue_cents)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
