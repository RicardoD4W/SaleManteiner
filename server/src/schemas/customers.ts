import { z } from 'zod';
import { LongText, RowId, ShortText } from './common.js';

export const CreateCustomerInput = z
  .object({
    name: ShortText,
    phone: ShortText.nullable().optional(),
    address: LongText.nullable().optional(),
    notes: LongText.nullable().optional(),
  })
  .strict();

export const UpdateCustomerInput = z
  .object({
    name: ShortText.optional(),
    phone: ShortText.nullable().optional(),
    address: LongText.nullable().optional(),
    notes: LongText.nullable().optional(),
  })
  .strict();

export const Customer = z.object({
  id: RowId,
  name: ShortText,
  phone: ShortText.nullable(),
  address: LongText.nullable(),
  notes: LongText.nullable(),
  created_at: z.string(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
export type Customer = z.infer<typeof Customer>;
