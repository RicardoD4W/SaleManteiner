import { z } from 'zod';
import { RowId } from './common.js';
import { CustomerNameField } from './fields.js';

export const CustomerPhoneField = z.string().max(40, 'Máximo 40 caracteres');

export const CustomerAddressField = z.string().max(200, 'Máximo 200 caracteres');

export const CustomerNotesField = z.string().max(5000, 'Máximo 5000 caracteres');

export const CreateCustomerInput = z
  .object({
    name: CustomerNameField,
    phone: CustomerPhoneField.nullable().optional(),
    address: CustomerAddressField.nullable().optional(),
    notes: CustomerNotesField.nullable().optional(),
  })
  .strict();

export const UpdateCustomerInput = z
  .object({
    name: CustomerNameField.optional(),
    phone: CustomerPhoneField.nullable().optional(),
    address: CustomerAddressField.nullable().optional(),
    notes: CustomerNotesField.nullable().optional(),
  })
  .strict();

export const Customer = z.object({
  id: RowId,
  name: CustomerNameField,
  phone: CustomerPhoneField.nullable().optional(),
  address: CustomerAddressField.nullable().optional(),
  notes: CustomerNotesField.nullable().optional(),
  created_at: z.string(),
});

export interface CustomerWithMetrics extends Customer {
  ventas: number;
  total_gastado: number;
  deuda: number;
}

export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
export type Customer = z.infer<typeof Customer>;
