import { apiFetch } from './client.js';
import type { Customer } from '../schemas/customers.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customers.js';

interface ListResponse {
  data: Customer[];
}
interface ItemResponse {
  data: Customer;
}
interface SearchResponse {
  data: Customer[];
}

export const customersApi = {
  list: () => apiFetch<ListResponse>('/api/customers').then((r) => r.data),

  getById: (id: number) => apiFetch<ItemResponse>(`/api/customers/${id}`).then((r) => r.data),

  search: (q: string) =>
    apiFetch<SearchResponse>(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => r.data),

  create: (input: CreateCustomerInput) =>
    apiFetch<ItemResponse>('/api/customers', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateCustomerInput) =>
    apiFetch<ItemResponse>(`/api/customers/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((r) => r.data),

  remove: (id: number) => apiFetch<void>(`/api/customers/${id}`, { method: 'DELETE' }),

  removeCascade: (id: number) =>
    apiFetch<void>(`/api/customers/${id}/cascade`, { method: 'DELETE' }),
};
