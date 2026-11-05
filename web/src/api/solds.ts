import { apiFetch } from './client.js';
import type { Sold, SoldWithItems, SaleItemOutput } from '../schemas/solds.js';
import type { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';

export interface SoldWithProfit extends Sold {
  profit: number;
  paid_amount: number | null;
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

interface MetricsStatsResponse {
  data: MetricsStats;
}

export interface MetricsStats {
  kpis: {
    ingresos_total_eur: number;
    beneficio_total_eur: number;
    gastos_total_eur: number;
    beneficio_neto_eur: number;
    margen_pct: number;
    gastos_sobre_ingresos_pct: number;
    ticket_medio_eur: number;
    beneficio_medio_venta_eur: number;
    ventas_count: number;
    clientes_count: number;
    clientes_con_deuda: number;
    deuda_total_eur: number;
    stock_pendiente_count: number;
    stock_coste_total_eur: number;
  };
  mes_actual: {
    month: string;
    ingresos: number;
    beneficio: number;
    gastos: number;
    resultado: number;
    margen_pct: number;
    ventas: number;
  };
  mes_anterior: {
    month: string;
    ingresos: number;
    beneficio: number;
    gastos: number;
    resultado: number;
    margen_pct: number;
    ventas: number;
  };
  variaciones: {
    ingresos_pct: number | null;
    beneficio_pct: number | null;
    gastos_pct: number | null;
    resultado_pct: number | null;
    margen_puntos: number | null;
  } | null;
  margen_productos: Array<{
    product_id: number;
    product_name: string;
    unidades: number;
    ingresos: number;
    beneficio: number;
    margen_pct: number;
  }>;
  deudores: Array<{
    customer_id: number;
    customer_name: string;
    ventas: number;
    deuda: number;
  }>;
  gastos_categoria: Array<{
    category_id: number;
    name: string;
    total: number;
    pct: number;
  }>;
}

export interface DashboardStats {
  kpis: {
    compras_total_eur: number;
    ventas_total_eur: number;
    beneficio_total_eur: number;
    gastos_total_eur: number;
    beneficio_neto_eur: number;
    stock_pendiente_count: number;
  };

  cashFlowByMonth: Array<{
    month: string;
    ingresos: number;
    compras: number;
    gastos: number;
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

  metricsStats: () => apiFetch<MetricsStatsResponse>('/api/stats/metrics').then((r) => r.data),
};
