import { z } from 'zod';
import { EuroMoney, LocalDate, LongText, RowId } from './common.js';
import { ProductNameField, QuantityField } from './fields.js';

const BuyTagSchema = z.object({
  id: RowId,
  name: z.string().min(1).max(200),
  color: z.string().min(1),
});

export const CreateBuyInput = z
  .object({
    product_name: ProductNameField,
    purchase_cost: EuroMoney.optional().default(0),
    quantity: QuantityField.optional().default(1),
    associated_costs: EuroMoney.optional().default(0),
    purchase_date: LocalDate.optional(),
    notes: LongText.nullable().optional(),
    tag_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const UpdateBuyInput = z
  .object({
    product_name: ProductNameField.optional(),
    purchase_cost: EuroMoney.optional(),
    quantity: QuantityField.optional(),
    associated_costs: EuroMoney.optional(),
    purchase_date: LocalDate.nullable().optional(),
    notes: LongText.nullable().optional(),
    tag_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const Buy = z.object({
  id: RowId,
  product_name: ProductNameField,
  purchase_cost: EuroMoney,
  quantity: QuantityField,
  total_cost: EuroMoney,
  associated_costs: EuroMoney,
  purchase_date: LocalDate.nullable(),
  notes: LongText.nullable(),
  tag: BuyTagSchema.nullable(),
  created_at: z.string(),
});

export type CreateBuyInput = z.infer<typeof CreateBuyInput>;
export type UpdateBuyInput = z.infer<typeof UpdateBuyInput>;
export type Buy = z.infer<typeof Buy>;
