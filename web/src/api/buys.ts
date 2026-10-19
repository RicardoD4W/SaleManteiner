/**
 * Funciones de API para compras. Cada una devuelve el `data` del envelope.
 */
import { apiFetch } from './client.js';
import type { Buy } from '../schemas/buys.js';
import type { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

/** Compra con su stock disponible calculado (S3 del feature dashboard-iteration-1). */
export interface BuyWithStock extends Buy {
  /** Unidades disponibles para vender: quantity - SUM(sale_items.quantity). */
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

  /**
   * Borra la compra EN CASCADA: limpia las ventas asociadas (si la venta
   * tiene otros buys, solo quita este item del pack; si la venta queda
   * con 0 items, también la borra). El endpoint está separado del
   * `remove` normal porque el `remove` devuelve 409 cuando hay ventas
   * para pedir confirmación al usuario (no es silencioso).
   */
  removeCascade: (id: number) =>
    apiFetch<void>(`/api/buys/${id}/cascade`, { method: 'DELETE' }),
};
