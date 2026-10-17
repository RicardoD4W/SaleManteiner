import { useQuery } from '@tanstack/react-query';
import { salesApi } from '../api/sales.js';

export function useSale(id: number) {
  return useQuery({
    queryKey: ['sales', id],
    queryFn: () => salesApi.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
