import { z } from 'zod';
import { RowId } from './common.js';
import { CustomerNameField } from './fields.js';

export const CreateCustomerInput = z
  .object({
    name: CustomerNameField,
  })
  .strict();

export const UpdateCustomerInput = z
  .object({
    name: CustomerNameField.optional(),
  })
  .strict();

export const Customer = z.object({
  id: RowId,
  name: CustomerNameField,
  created_at: z.string(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
export type Customer = z.infer<typeof Customer>;
