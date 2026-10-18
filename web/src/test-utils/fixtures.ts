/**
 * Fixtures reutilizables para tests (modelo buys/solds/customers).
 *
 * Datos "realistas" (no placeholders tipo "test") para que los snapshots
 * visuales y aserciones tengan sentido. Los importes van en EUROS DECIMALES
 * (no céntimos) — coherente con el modelo del feature buys-and-solds.
 */

// ── Buy ──────────────────────────────────────────────────────────────
export const buyFixture = {
  id: 1,
  product_name: 'Funda iPhone',
  purchase_cost: 50.0,
  quantity: 10,
  associated_costs: 5.0,
  purchase_date: '2026-09-28',
  created_at: '2026-10-01T10:00:00.000Z',
};

export const pendingBuyFixture = {
  id: 2,
  product_name: 'Cargador USB-C',
  purchase_cost: 30.0,
  quantity: 5,
  associated_costs: 0.0,
  purchase_date: '2026-10-05',
  created_at: '2026-10-05T09:00:00.000Z',
};

// ── Sold (con items para packs) ────────────────────────────────────
export const soldFixture = {
  id: 1,
  customer_id: 1,
  sale_price: 40.0,
  associated_costs: 2.0,
  sold_at: '2026-10-05',
  notes: 'Venta pack',
  created_at: '2026-10-05T14:30:00.000Z',
};

export const soldWithItemsFixture = {
  ...soldFixture,
  customer_name: 'Juan Pérez',
  items: [
    { buy_id: 1, product_name: 'Funda iPhone', quantity: 2, unit_cost: 5.0, unit_assoc: 0.5 },
    { buy_id: 2, product_name: 'Cargador USB-C', quantity: 1, unit_cost: 6.0, unit_assoc: 0.0 },
  ],
};

// ── Customer ───────────────────────────────────────────────────────
export const customerFixture = {
  id: 1,
  name: 'Juan Pérez',
  created_at: '2026-09-01T10:00:00.000Z',
};

// ── DashboardStats (S11) ───────────────────────────────────────────
import type { DashboardStats } from '../api/solds.js';

export const dashboardStatsFixture: DashboardStats = {
  kpis: {
    compras_total_eur: 130.0,
    ventas_total_eur: 40.0,
    beneficio_total_eur: 8.0,
    stock_pendiente_count: 1,
  },
  revenueByMonth: [
    { month: '2025-11', revenue: 0, profit: 0 },
    { month: '2025-12', revenue: 0, profit: 0 },
    { month: '2026-01', revenue: 0, profit: 0 },
    { month: '2026-02', revenue: 0, profit: 0 },
    { month: '2026-03', revenue: 0, profit: 0 },
    { month: '2026-04', revenue: 0, profit: 0 },
    { month: '2026-05', revenue: 0, profit: 0 },
    { month: '2026-06', revenue: 0, profit: 0 },
    { month: '2026-07', revenue: 0, profit: 0 },
    { month: '2026-08', revenue: 0, profit: 0 },
    { month: '2026-09', revenue: 0, profit: 0 },
    { month: '2026-10', revenue: 40.0, profit: 8.0 },
  ],
  topProducts: [
    { product_name: 'Funda iPhone', times_sold: 2, total_revenue: 20.0, total_profit: 16.0 },
    { product_name: 'Cargador USB-C', times_sold: 1, total_revenue: 10.0, total_profit: 8.8 },
  ],
  topBuyers: [{ customer_id: 1, customer_name: 'Juan Pérez', ventas: 1, total_gastado: 40.0 }],
};

export const emptyDashboardStatsFixture: DashboardStats = {
  kpis: { compras_total_eur: 0, ventas_total_eur: 0, beneficio_total_eur: 0, stock_pendiente_count: 0 },
  revenueByMonth: dashboardStatsFixture.revenueByMonth.map((m) => ({ ...m, revenue: 0, profit: 0 })),
  topProducts: [],
  topBuyers: [],
};
