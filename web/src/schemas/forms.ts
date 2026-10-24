import { z } from 'zod';
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
});

export type BuyFormInput = z.input<typeof BuyFormSchema>;
export type BuyFormOutput = z.output<typeof BuyFormSchema>;

export const SoldFieldsSchema = z.object({
  customer_id: CustomerIdField,
  sale_price: EuroMoneyField,
  associated_costs: EuroMoneyField,
  sold_at: FormDateField,
  notes: NotesField,
});

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
});

export const SoldEditFormSchema = SoldFieldsSchema;

export type SoldFormInput = z.input<typeof SoldFormSchema>;
export type SoldFormOutput = z.output<typeof SoldFormSchema>;
export type SoldEditFormInput = z.input<typeof SoldEditFormSchema>;
export type SoldEditFormOutput = z.output<typeof SoldEditFormSchema>;

export const CustomerFormSchema = z.object({
  name: CustomerNameField,
});

export type CustomerFormInput = z.input<typeof CustomerFormSchema>;
export type CustomerFormOutput = z.output<typeof CustomerFormSchema>;
