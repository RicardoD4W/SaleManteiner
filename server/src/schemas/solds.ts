import { z } from 'zod';
import { EuroMoney, LocalDate, RowId, LongText } from './common.js';

const Quantity = z.number().int().min(1);

export const SaleItemInput = z
  .object({
    buy_id: RowId,
    quantity: Quantity,
  })
  .strict();

export type SaleItemInput = z.infer<typeof SaleItemInput>;

export const CreateSoldInput = z
  .object({
    customer_id: RowId,
    sale_price: EuroMoney.optional().default(0),
    associated_costs: EuroMoney.optional().default(0),
    sold_at: LocalDate.optional(),
    notes: LongText.nullable().optional(),
    items: z.array(SaleItemInput).min(1),
  })
  .strict();

export const UpdateSoldInput = z
  .object({
    customer_id: RowId.optional(),
    sale_price: z.number().nonnegative().optional(),
    associated_costs: z.number().nonnegative().optional(),
    sold_at: LocalDate.nullable().optional(),
    notes: LongText.nullable().optional(),
  })
  .strict();

export const Sold = z.object({
  id: RowId,
  customer_id: RowId,
  sale_price: EuroMoney,
  associated_costs: EuroMoney,
  sold_at: LocalDate.nullable(),
  notes: LongText.nullable(),
  created_at: z.string(),
});

export type CreateSoldInput = z.infer<typeof CreateSoldInput>;
export type UpdateSoldInput = z.infer<typeof UpdateSoldInput>;
export type Sold = z.infer<typeof Sold>;

export interface SaleItemOutput {
  buy_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  unit_assoc: number;
}

export interface SoldWithItems extends Sold {
  customer_name: string;
  items: SaleItemOutput[];
}
