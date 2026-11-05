import { apiFetch } from './client.js';

export interface ProductName {
  name: string;
  uses: number;
}

interface ListResponse {
  data: ProductName[];
}

export const productsApi = {
  list: () => apiFetch<ListResponse>('/api/products').then((r) => r.data),
};
