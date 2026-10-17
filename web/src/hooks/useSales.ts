import { useQuery } from '@tanstack/react-query';
import { salesApi, type ListFilters } from '../api/sales.js';

export function useSales(filters: ListFilters = {}) {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: () => salesApi.list(filters),
  });
}
