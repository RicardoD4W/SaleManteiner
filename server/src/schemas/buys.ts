import { z } from 'zod';
import { EuroMoney, LocalDate, RowId, ShortText } from './common.js';

const ProductName = ShortText;

const Quantity = z.number().int().min(1);

export const CreateBuyInput = z
  .object({
    product_name: ProductName,
    purchase_cost: EuroMoney.optional().default(0),
    quantity: Quantity.optional().default(1),
    associated_costs: EuroMoney.optional().default(0),
    purchase_date: LocalDate.optional(),
  })
  .strict();

export const UpdateBuyInput = z
  .object({
    product_name: ProductName.optional(),
    purchase_cost: z.number().nonnegative().optional(),
    quantity: Quantity.optional(),
    associated_costs: z.number().nonnegative().optional(),
    purchase_date: LocalDate.nullable().optional(),
  })
  .strict();

export const Buy = z.object({
  id: RowId,
  product_name: ProductName,
  purchase_cost: EuroMoney,
  quantity: Quantity,
  associated_costs: EuroMoney,
  purchase_date: LocalDate.nullable(),
  created_at: z.string(),
});

export type CreateBuyInput = z.infer<typeof CreateBuyInput>;
export type UpdateBuyInput = z.infer<typeof UpdateBuyInput>;
export type Buy = z.infer<typeof Buy>;
