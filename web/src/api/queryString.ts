import type { DateRange } from '../lib/dateRange.js';

export type QueryParams = Record<string, string | undefined>;

export interface TagFilter {
  tagIds?: number[];
  sinTag?: boolean;
}

export function buildQuery(params: QueryParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function dateRangeQuery(range?: DateRange): string {
  return buildQuery({ from: range?.from, to: range?.to });
}

export function tagFilterParams(filter?: TagFilter): QueryParams {
  const tagIds = filter?.tagIds ?? [];
  return {
    tag_ids: tagIds.length > 0 ? tagIds.join(',') : undefined,
    sin_tag: filter?.sinTag ? 'true' : undefined,
  };
}
