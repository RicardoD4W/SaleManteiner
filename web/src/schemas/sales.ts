/**
 * Schemas Zod de ventas para la UI.
 * (Duplicado de server/src/schemas/sales.ts. El output `Sale` es el contrato con la API;
 * `CreateSaleInput` y `UpdateSaleInput` son los formatos de la API.)
 *
 * El form usa schemas separados en euros (ver SaleForm.tsx) y convierte a cents
 * antes de llamar a la API. Esto evita pedirle al usuario que ingrese "1500" para 15€.
 */
import { z } from 'zod';
import type { $RefinementCtx } from 'zod/v4/core';
import { Cents, ISODateTime, LocalDate, LongText, RowId, ShortText } from './common.js';

const CentsInput = z.number().int().nonnegative().default(0).brand<'Cents'>();

/**
 * Coherencia `sold` ↔ `sold_at` en create.
 * Espejo del refine del server. La defensa en profundidad importa: si el
 * form algún día deja de mandar ambos campos, esto atrapa el error antes
 * de pegarle al backend.
 */
const soldCreateCoherenceRefine = (
  data: { sold: boolean; sold_at?: string | null },
  ctx: $RefinementCtx,
): void => {
  if (data.sold && data.sold_at == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['sold_at'],
      message: 'Si la venta está marcada como vendida, sold_at es obligatorio.',
    });
  }
  if (!data.sold && data.sold_at != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['sold_at'],
      message: 'sold_at debe ser null cuando sold es false.',
    });
  }
};

/**
 * Coherencia `sold` ↔ `sold_at` en update. Espejo del server.
 * Solo se valida si el cliente envía AMBOS campos; ausencia = "no cambiar".
 */
const soldUpdateCoherenceRefine = (
  data: { sold?: boolean; sold_at?: string | null },
  ctx: $RefinementCtx,
): void => {
  if (data.sold === undefined || data.sold_at === undefined) return;
  if (data.sold && data.sold_at == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['sold_at'],
      message: 'Si la venta está marcada como vendida, sold_at es obligatorio.',
    });
  }
  if (!data.sold && data.sold_at != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['sold_at'],
      message: 'sold_at debe ser null cuando sold es false.',
    });
  }
};

export const CreateSaleInput = z
  .object({
    product_name: ShortText,
    buyer_name: ShortText.optional(),
    cost_cents: CentsInput,
    price_cents: CentsInput,
    associated_costs_cents: CentsInput,
    sold: z.boolean().default(false),
    purchase_date: LocalDate.optional(),
    sold_at: ISODateTime.nullable().optional(),
    notes: LongText.optional(),
  })
  .strict()
  .superRefine(soldCreateCoherenceRefine);

export const UpdateSaleInput = z
  .object({
    product_name: ShortText.optional(),
    buyer_name: ShortText.optional(),
    cost_cents: z.number().int().nonnegative().optional(),
    price_cents: z.number().int().nonnegative().optional(),
    associated_costs_cents: z.number().int().nonnegative().optional(),
    sold: z.boolean().optional(),
    purchase_date: LocalDate.nullable().optional(),
    sold_at: ISODateTime.nullable().optional(),
    notes: LongText.optional(),
  })
  .strict()
  .superRefine(soldUpdateCoherenceRefine);

export const Sale = z.object({
  id: RowId,
  product_name: ShortText,
  buyer_name: ShortText.nullable(),
  cost_cents: Cents,
  price_cents: Cents,
  associated_costs_cents: Cents,
  sold: z.boolean(),
  purchase_date: LocalDate.nullable(),
  notes: LongText.nullable(),
  created_at: ISODateTime,
  sold_at: ISODateTime.nullable(),
});

export type CreateSaleInput = z.infer<typeof CreateSaleInput>;
export type UpdateSaleInput = z.infer<typeof UpdateSaleInput>;
export type Sale = z.infer<typeof Sale>;
