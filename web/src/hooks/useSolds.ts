import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import type { DateRange } from '../lib/dateRange.js';

export function useSolds(range?: DateRange) {
  return useQuery({
    queryKey: ['solds', range?.from ?? null, range?.to ?? null],
    queryFn: () => soldsApi.list(range),
    placeholderData: (previous) => previous,
  });
}
