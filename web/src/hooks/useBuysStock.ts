import { useQuery } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';

export function useBuysStock() {
  return useQuery({
    queryKey: ['buys', 'stock'],
    queryFn: buysApi.getStock,
  });
}
