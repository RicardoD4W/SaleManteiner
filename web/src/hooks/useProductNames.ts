import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/products.js';

export function useProductNames() {
  return useQuery({
    queryKey: ['products'],
    queryFn: productsApi.list,
    staleTime: 60_000,
  });
}
