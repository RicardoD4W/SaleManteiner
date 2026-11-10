import { useQuery } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { TagFilter } from '../api/queryString.js';
import type { DateRange } from '../lib/dateRange.js';

export function useBuys(range?: DateRange, filter?: TagFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [
      'buys',
      range?.from ?? null,
      range?.to ?? null,
      filter?.tagIds ?? null,
      filter?.sinTag ?? false,
    ],
    queryFn: () => buysApi.list(range, filter),
    placeholderData: (previous) => previous,
    enabled: options?.enabled,
  });
}
