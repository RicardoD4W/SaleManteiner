import type { DateRange } from '../lib/dateRange.js';

export function dateRangeQuery(range?: DateRange): string {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);

  const query = params.toString();
  return query ? `?${query}` : '';
}
