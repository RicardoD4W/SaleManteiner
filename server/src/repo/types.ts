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

export interface AssociatedExpense {
  id: number;
  concept: string;
  amount: number;
  expense_date: string;
}

export interface SaleAdjustment {
  sold_id: number;
  sale_price_before: number;
  sale_price_after: number;
  associated_costs_before: number;
  associated_costs_after: number;
  paid_amount_before: number;
  paid_amount_after: number;
}

export type CascadeResult = { ok: true } | { ok: false; code: 'NOT_FOUND' };

export type BuyCascadeResult =
  { ok: true; adjustments: SaleAdjustment[] } | { ok: false; code: 'NOT_FOUND' };
