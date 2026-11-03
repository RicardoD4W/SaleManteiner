import { z } from 'zod';
import { EuroMoney, LocalDate, LongText, Quantity, RowId } from './common.js';

export const PAID_AMOUNT_EXCEEDS_PRICE_MESSAGE =
  'El importe cobrado no puede superar el precio de venta';

export const SaleItemInput = z
  .object({
    buy_id: RowId,
    quantity: Quantity,
  })
  .strict();

export const CreateSoldInput = z
  .object({
    customer_id: RowId,
    sale_price: EuroMoney.optional().default(0),
    associated_costs: EuroMoney.optional().default(0),
    paid_amount: EuroMoney.optional().default(0),
    sold_at: LocalDate.optional(),
    notes: LongText.nullable().optional(),
    items: z.array(SaleItemInput).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.paid_amount > data.sale_price) {
      ctx.addIssue({
        code: 'custom',
        path: ['paid_amount'],
        message: PAID_AMOUNT_EXCEEDS_PRICE_MESSAGE,
      });
    }
  });

export const UpdateSoldInput = z
  .object({
    customer_id: RowId.optional(),
    sale_price: EuroMoney.optional(),
    associated_costs: EuroMoney.optional(),
    paid_amount: EuroMoney.optional(),
    sold_at: LocalDate.nullable().optional(),
    notes: LongText.nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.paid_amount !== undefined && data.sale_price !== undefined) {
      if (data.paid_amount > data.sale_price) {
        ctx.addIssue({
          code: 'custom',
          path: ['paid_amount'],
          message: PAID_AMOUNT_EXCEEDS_PRICE_MESSAGE,
        });
      }
    }
  });

export const Sold = z.object({
  id: RowId,
  customer_id: RowId,
  sale_price: EuroMoney,
  associated_costs: EuroMoney,
  paid_amount: EuroMoney,
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
