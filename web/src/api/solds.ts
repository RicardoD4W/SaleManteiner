import { apiFetch } from './client.js';
import type { Sold, SoldWithItems, SaleItemOutput } from '../schemas/solds.js';
import type { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';

export interface SoldWithProfit extends Sold {
  profit: number;
  items: SaleItemOutput[];
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

export interface DashboardStats {
  kpis: {
    compras_total_eur: number;
    ventas_total_eur: number;
    beneficio_total_eur: number;
    stock_pendiente_count: number;
  };

  cashFlowByMonth: Array<{
    month: string;
    ingresos: number;
    compras: number;
    beneficio: number;
    resultado: number;
  }>;

  totals12m: {
    ingresos: number;
    beneficio: number;
    mejor_mes: { month: string; ingresos: number } | null;
  };
  topProducts: Array<{
    product_id: number;
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
  list: () => apiFetch<ListResponse>('/api/solds').then((r) => r.data),

  getByIdWithItems: (id: number) =>
    apiFetch<ItemWithItemsResponse>(`/api/solds/${id}`).then((r) => r.data),

  create: (input: CreateSoldInput) =>
    apiFetch<ItemResponse>('/api/solds', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateSoldInput) =>
    apiFetch<ItemResponse>(`/api/solds/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.data,
    ),

  remove: (id: number) => apiFetch<void>(`/api/solds/${id}`, { method: 'DELETE' }),

  dashboardStats: () =>
    apiFetch<DashboardStatsResponse>('/api/stats/dashboard').then((r) => r.data),
};
