import { useQuery } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';

export function useBuy(id: number) {
  return useQuery({
    queryKey: ['buys', id],
    queryFn: () => buysApi.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
