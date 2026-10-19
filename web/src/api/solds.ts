/**
 * Funciones de API para ventas. Cada una devuelve el `data` del envelope.
 */
import { apiFetch } from './client.js';
import type { Sold, SoldWithItems } from '../schemas/solds.js';
import type { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';

/**
 * Sold con el profit calculado (S13 del feature buys-and-solds):
 * `sale_price - associated_costs - COGS_prorrateado - buy.associated_prorrateado`.
 * Alimenta `GET /api/solds` para que la tabla de /solds muestre el profit real
 * sin tener que cargar los items de cada venta (S3 del feature
 * dashboard-iteration-1).
 */
export interface SoldWithProfit extends Sold {
  profit: number;
}

interface ListResponse {
  data: SoldWithProfit[];
}
interface ItemResponse {
  data: Sold;
}
interface ItemWithItemsResponse {
  data: SoldWithItems;
}

interface DashboardStatsResponse {
  data: DashboardStats;
}

/**
 * Payload de GET /api/stats/dashboard (S11 del feature buys-and-solds, S5 del
 * feature dashboard-iteration-1).
 * Importes en euros decimales (no céntimos) — la BD guarda REAL y el server
 * ya hace el prorrateo por unidad.
 */
export interface DashboardStats {
  kpis: {
    compras_total_eur: number;
    ventas_total_eur: number;
    beneficio_total_eur: number;
    stock_pendiente_count: number;
  };
  /**
   * Cash flow mensual (S5 del feature dashboard-iteration-1).
   *  - compras = inversión del mes (suma de buys.purchase_cost + buys.associated_costs
   *    de compras con purchase_date en el mes, más solds.associated_costs de
   *    ventas con sold_at en el mes).
   *  - ventas = profit realizado por ventas del mes (sale_price - associated_costs
   *    - COGS prorrateado - buy_assoc prorrateado, fórmula S13).
   *  - neto = compras - ventas. Convención del spec: negativo=pérdida, positivo=ganancia.
   *    El chart colorea rojo bajo cero y verde sobre cero.
   * 12 meses consecutivos, meses sin actividad con 0.
   */
  cashFlowByMonth: Array<{ month: string; compras: number; ventas: number; neto: number }>;
  topProducts: Array<{
    product_name: string;
    times_sold: number;
    total_revenue: number;
    total_profit: number;
  }>;
  topBuyers: Array<{
    customer_id: number;
    customer_name: string;
    ventas: number;
    total_gastado: number;
  }>;
}

export const soldsApi = {
  list: () =>
    apiFetch<ListResponse>('/api/solds').then((r) => r.data),

  getById: (id: number) =>
    apiFetch<ItemResponse>(`/api/solds/${id}`).then((r) => r.data),

  /** Detalle con items (para GET /solds/:id con pack info). */
  getByIdWithItems: (id: number) =>
    apiFetch<ItemWithItemsResponse>(`/api/solds/${id}`).then((r) => r.data),

  create: (input: CreateSoldInput) =>
    apiFetch<ItemResponse>('/api/solds', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateSoldInput) =>
    apiFetch<ItemResponse>(`/api/solds/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.data,
    ),

  remove: (id: number) => apiFetch<void>(`/api/solds/${id}`, { method: 'DELETE' }),

  /** Stats del dashboard (S11). */
  dashboardStats: () =>
    apiFetch<DashboardStatsResponse>('/api/stats/dashboard').then((r) => r.data),
};
