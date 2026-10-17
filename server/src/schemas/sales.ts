/**
 * Schemas Zod de ventas (MVP manual).
 * Principios aplicados (skill zod):
 *  - schema a nivel de módulo
 *  - exporta schema + tipo inferido
 *  - safeParse en los endpoints (parse nunca en repo)
 *  - `.default()` SOLO en create (skill refine-defaults: ausencia ≠ "no cambiar")
 *  - UpdateInput = manual con `.optional()` (no `.partial()`) porque el default
 *    de create rompe la semántica de PATCH: ausencia debe ser `undefined`,
 *    no el default.
 *  - `.strict()` en inputs de API (skill object-strict-vs-strip)
 *  - `.nullable()` en output para campos que pueden ser NULL en SQLite
 *    (skill object-optional-vs-nullable)
 *
 * Fechas (regla nueva respecto al MVP inicial):
 *  - `purchase_date`: día local `YYYY-MM-DD`, opcional y editable por el cliente.
 *  - `sold_at`: lo gestiona el cliente. La regla "server auto-setea al flip
 *    de sold" se eliminó; el server respeta siempre el input. El form rellena
 *    automáticamente con hoy al flippear el checkbox "ya lo vendí".
 *  - Refinamiento (S3): `sold=true` exige `sold_at` no nulo;
 *    `sold=false` exige `sold_at` nulo. Lo garantiza el form y lo verifica Zod.
 *
 * Nota sobre Zod 4 + marca `Cents`:
 *  - `.default(valor)` se evalúa ANTES de la marca. Si pusiéramos
 *    `Cents.default(0)` (con la marca ya aplicada), Zod 4 exigiría un
 *    valor branded y `0` no lo es. Por eso definimos `CentsInput`
 *    con `default(0)` antes de `brand<'Cents'>()`: el default es
 *    un `number` válido, y la marca se aplica al final.
 */
import { z } from 'zod';
import type { $RefinementCtx } from 'zod/v4/core';
import { Cents, ISODateTime, LocalDate, LongText, RowId, ShortText } from './common.js';

const ProductName = ShortText;

/** Cents con default 0 para inputs. El output es `Cents` (misma marca que en common.ts). */
const CentsInput = z.number().int().nonnegative().default(0).brand<'Cents'>();

/**
 * Refinamiento: coherencia entre `sold` y `sold_at` en create.
 * En create siempre tenemos `sold` (con default) → podemos validar la invariante.
 * `sold_at == null` cubre tanto `undefined` (no enviado) como `null` explícito.
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
 * Refinamiento: coherencia entre `sold` y `sold_at` en update.
 * En update, ausencia = "no cambiar este campo". Si el cliente envía ambos
 * (incluso `sold_at: null`), validamos que sean coherentes entre sí.
 * Si solo envía uno de los dos, el server combina con el estado existente
 * (responsabilidad del cliente mantener la invariante global — el form
 * siempre manda los dos).
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
    product_name: ProductName,
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

/**
 * Update: ausencia = "no cambiar". Usamos `.optional()` (no `.default()`)
 * para que el parse preserve `undefined` en los campos no enviados.
 * Si usáramos `CreateSaleInput.partial()`, el default de create se aplicaría
 * también acá y "no enviar cost_cents" se volvería "setear cost_cents = 0".
 *
 * `purchase_date` y `sold_at` son `.nullable().optional()`: el cliente
 * puede mandarlos, omitirlos, o pedir explícitamente null para borrar.
 * El repo filtra `undefined` antes de hacer spread, así que `null` sí
 * pisa el valor existente a null (útil para "borrar fecha de venta").
 */
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

/** Output: nullable para los campos que pueden ser NULL en SQLite. */
export const Sale = z.object({
  id: RowId,
  product_name: ProductName,
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
