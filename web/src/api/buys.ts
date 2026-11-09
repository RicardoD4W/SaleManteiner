import { apiFetch } from './client.js';
import { buildQuery, tagFilterParams, type TagFilter } from './queryString.js';
import type { DateRange } from '../lib/dateRange.js';
import type { Buy, CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

export interface BuyWithStock extends Buy {
  disponibles: number;
}

interface ListResponse {
  data: BuyWithStock[];
}
interface ItemResponse {
  data: Buy;
}
interface StockResponse {
  data: BuyWithStock[];
}

export const buysApi = {
  list: (range?: DateRange, filter?: TagFilter) =>
    apiFetch<ListResponse>(
      `/api/buys${buildQuery({
        from: range?.from,
        to: range?.to,
        ...tagFilterParams(filter),
      })}`,
    ).then((r) => r.data),

  getById: (id: number) => apiFetch<ItemResponse>(`/api/buys/${id}`).then((r) => r.data),

  getStock: () => apiFetch<StockResponse>('/api/buys/stock').then((r) => r.data),

  create: (input: CreateBuyInput) =>
    apiFetch<ItemResponse>('/api/buys', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateBuyInput) =>
    apiFetch<ItemResponse>(`/api/buys/${id}`, { method: 'PATCH', body: input }).then((r) => r.data),

  remove: (id: number) => apiFetch<void>(`/api/buys/${id}`, { method: 'DELETE' }),

  removeCascade: (id: number) => apiFetch<void>(`/api/buys/${id}/cascade`, { method: 'DELETE' }),
};
