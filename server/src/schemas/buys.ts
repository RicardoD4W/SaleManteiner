import { z } from 'zod';
import { EuroMoney, LocalDate, LongText, Quantity, RowId, ShortText } from './common.js';
import { TagColor } from './tags.js';

export const BuyTag = z.object({ id: RowId, name: ShortText, color: TagColor });
export type BuyTag = z.infer<typeof BuyTag>;

export const CreateBuyInput = z
  .object({
    product_name: ShortText,
    purchase_cost: EuroMoney.optional().default(0),
    quantity: Quantity.optional().default(1),
    associated_costs: EuroMoney.optional().default(0),
    purchase_date: LocalDate.optional(),
    notes: LongText.nullable().optional(),
    tag_id: RowId.nullable().optional(),
  })
  .strict();

export const UpdateBuyInput = z
  .object({
    product_name: ShortText.optional(),
    purchase_cost: EuroMoney.optional(),
    quantity: Quantity.optional(),
    associated_costs: EuroMoney.optional(),
    purchase_date: LocalDate.nullable().optional(),
    notes: LongText.nullable().optional(),
    tag_id: RowId.nullable().optional(),
  })
  .strict();

export const Buy = z.object({
  id: RowId,
  product_name: ShortText,
  purchase_cost: EuroMoney,
  quantity: Quantity,
  total_cost: EuroMoney,
  associated_costs: EuroMoney,
  purchase_date: LocalDate.nullable(),
  notes: LongText.nullable(),
  tag: BuyTag.nullable(),
  created_at: z.string(),
});

export type CreateBuyInput = z.infer<typeof CreateBuyInput>;
export type UpdateBuyInput = z.infer<typeof UpdateBuyInput>;
export type Buy = z.infer<typeof Buy>;
