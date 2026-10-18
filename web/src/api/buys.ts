/**
 * Funciones de API para compras. Cada una devuelve el `data` del envelope.
 */
import { apiFetch } from './client.js';
import type { Buy } from '../schemas/buys.js';
import type { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

export interface BuyWithStock {
  id: number;
  product_name: string;
  quantity: number;
  /** Cantidad disponible para vender: quantity - SUM(sale_items.quantity). */
  disponibles: number;
}

interface ListResponse {
  data: Buy[];
}
interface ItemResponse {
  data: Buy;
}
interface StockResponse {
  data: BuyWithStock[];
}

export const buysApi = {
  list: () =>
    apiFetch<ListResponse>('/api/buys').then((r) => r.data),

  getById: (id: number) =>
    apiFetch<ItemResponse>(`/api/buys/${id}`).then((r) => r.data),

  /** Compras con stock disponible (disponibles > 0). Alimenta la modal de venta (S5). */
  getStock: () =>
    apiFetch<StockResponse>('/api/buys/stock').then((r) => r.data),

  create: (input: CreateBuyInput) =>
    apiFetch<ItemResponse>('/api/buys', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateBuyInput) =>
    apiFetch<ItemResponse>(`/api/buys/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.data,
    ),

  remove: (id: number) => apiFetch<void>(`/api/buys/${id}`, { method: 'DELETE' }),
};
