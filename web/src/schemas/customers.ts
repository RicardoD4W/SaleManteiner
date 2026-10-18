/**
 * Schemas Zod para clientes (customers). Mirror del server.
 *
 * Modelo mínimo (S9 del feature): solo id, name, created_at.
 * Sin contact (no pedido por el usuario).
 */
import { z } from 'zod';
import { RowId, ShortText } from './common.js';

export const CreateCustomerInput = z
  .object({
    name: ShortText,
  })
  .strict();

export const UpdateCustomerInput = z
  .object({
    name: ShortText.optional(),
  })
  .strict();

/** Output: todos los campos obligatorios (no hay nullable en este modelo mínimo). */
export const Customer = z.object({
  id: RowId,
  name: ShortText,
  created_at: z.string(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
export type Customer = z.infer<typeof Customer>;
