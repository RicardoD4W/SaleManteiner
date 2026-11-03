import { z } from 'zod';
import { CustomerAddressField, CustomerNotesField, CustomerPhoneField } from './customers.js';
import {
  CustomerIdField,
  CustomerNameField,
  EuroMoneyField,
  FormDateField,
  NotesField,
  ProductNameField,
  QuantityField,
} from './fields.js';

export const BuyFormSchema = z.object({
  product_name: ProductNameField,
  purchase_cost: EuroMoneyField,
  quantity: QuantityField,
  associated_costs: EuroMoneyField,
  purchase_date: FormDateField,
  notes: NotesField,
});

export type BuyFormInput = z.input<typeof BuyFormSchema>;
export type BuyFormOutput = z.output<typeof BuyFormSchema>;

export const SoldFieldsSchema = z.object({
  customer_id: CustomerIdField,
  sale_price: EuroMoneyField,
  associated_costs: EuroMoneyField,
  paid_amount: EuroMoneyField.default(0),
  sold_at: FormDateField,
  notes: NotesField,
});

function paidAmountNotAbovePrice(
  data: z.infer<typeof SoldFieldsSchema>,
  ctx: z.RefinementCtx,
): void {
  if (data.paid_amount > data.sale_price) {
    ctx.addIssue({
      code: 'custom',
      path: ['paid_amount'],
      message: 'El importe cobrado no puede superar el precio de venta',
    });
  }
}

export const SoldFormSchema = SoldFieldsSchema.extend({
  items: z
    .array(
      z.object({
        buy_id: z.number(),
        product_name: z.string(),
        quantity: QuantityField,
        max: z.number().int().min(1),
      }),
    )
    .min(1, 'Seleccioná al menos un producto'),
}).superRefine(paidAmountNotAbovePrice);

export const SoldEditFormSchema = SoldFieldsSchema.superRefine(paidAmountNotAbovePrice);

export type SoldFormInput = z.input<typeof SoldFormSchema>;
export type SoldFormOutput = z.output<typeof SoldFormSchema>;
export type SoldEditFormInput = z.input<typeof SoldEditFormSchema>;
export type SoldEditFormOutput = z.output<typeof SoldEditFormSchema>;

export const CustomerFormSchema = z.object({
  name: CustomerNameField,
  phone: CustomerPhoneField.optional(),
  address: CustomerAddressField.optional(),
  notes: CustomerNotesField.optional(),
});

export type CustomerFormInput = z.input<typeof CustomerFormSchema>;
export type CustomerFormOutput = z.output<typeof CustomerFormSchema>;
