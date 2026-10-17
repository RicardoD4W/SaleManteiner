/**
 * Funciones de API para ventas. Cada una devuelve el `data` del envelope.
 */
import { apiFetch } from './client.js';
import type { CreateSaleInput, Sale, UpdateSaleInput } from '../schemas/sales.js';

export interface ListFilters {
  sold?: boolean;
  limit?: number;
  offset?: number;
}

export interface SaleStats {
  total: number;
  sold: number;
  not_sold: number;
  revenue_cents: number;
  cost_cents: number;
  associated_costs_cents: number;
  net_profit_cents: number;
}

interface ListResponse {
  data: Sale[];
}
interface ItemResponse {
  data: Sale;
}
interface StatsResponse {
  data: SaleStats;
}

export const salesApi = {
  list: (filters: ListFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.sold !== undefined) params.set('sold', String(filters.sold));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.offset !== undefined) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return apiFetch<ListResponse>(`/api/sales${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  getById: (id: number) =>
    apiFetch<ItemResponse>(`/api/sales/${id}`).then((r) => r.data),

  create: (input: CreateSaleInput) =>
    apiFetch<ItemResponse>('/api/sales', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateSaleInput) =>
    apiFetch<ItemResponse>(`/api/sales/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.data,
    ),

  remove: (id: number) => apiFetch<void>(`/api/sales/${id}`, { method: 'DELETE' }),

  stats: () => apiFetch<StatsResponse>('/api/sales/stats').then((r) => r.data),
};
