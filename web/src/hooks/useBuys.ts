import { useQuery } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { DateRange } from '../lib/dateRange.js';

export function useBuys(range?: DateRange) {
  return useQuery({
    queryKey: ['buys', range?.from ?? null, range?.to ?? null],
    queryFn: () => buysApi.list(range),
    placeholderData: (previous) => previous,
  });
}
