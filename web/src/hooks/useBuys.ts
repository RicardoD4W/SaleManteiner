import { useQuery } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';

export function useBuys() {
  return useQuery({
    queryKey: ['buys'],
    queryFn: buysApi.list,
  });
}
