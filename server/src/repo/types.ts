export interface DateRange {
  from?: string;
  to?: string;
}

export interface AssociatedSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

export type CascadeResult = { ok: true } | { ok: false; code: 'NOT_FOUND' };
