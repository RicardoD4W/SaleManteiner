/**
 * Schemas Zod para compras (buys). Mirror del server.
 *
 * Principios aplicados (skill zod):
 *  - schema a nivel de módulo, exporta schema + tipo.
 *  - safeParse en los endpoints (parse nunca en repo).
 *  - `.strict()` en inputs de API (skill object-strict-vs-strip).
 *  - `.default()` SOLO en CreateBuyInput (ausencia = "usá el default").
 *  - UpdateBuyInput = manual con `.optional()` (no `.partial()`) porque el default
 *    de create rompería PATCH: ausencia debe ser `undefined`, no el default.
 *  - `.nullable().optional()` para campos que pueden ser null en SQLite
 *    (skill object-optional-vs-nullable).
 *
 * Modelo de datos (S1 del feature):
 *  - purchase_cost y associated_costs son TOTALES (no unitarios).
 *  - El coste unitario se calcula con round2(buy.purchase_cost / buy.quantity)
 *    cuando se necesita (stock, beneficio por venta).
 *  - quantity >= 1 (CHECK en SQL; Zod valida int().min(1)).
 *  - purchase_date es opcional (puede ser null si se creó sin fecha).
 */
import { z } from 'zod';
import { EuroMoney, LocalDate, RowId, ShortText } from './common.js';

const ProductName = ShortText;

/** Cantidad de unidades (entero >= 1). */
const Quantity = z.number().int().min(1);

export const CreateBuyInput = z
  .object({
    product_name: ProductName,
    purchase_cost: EuroMoney.optional().default(0),
    quantity: Quantity.optional().default(1),
    associated_costs: EuroMoney.optional().default(0),
    purchase_date: LocalDate.optional(),
  })
  .strict();

export const UpdateBuyInput = z
  .object({
    product_name: ProductName.optional(),
    purchase_cost: z.number().nonnegative().optional(),
    quantity: Quantity.optional(),
    associated_costs: z.number().nonnegative().optional(),
    purchase_date: LocalDate.nullable().optional(),
  })
  .strict();

/** Output: nullable para purchase_date (puede ser null en BD). */
export const Buy = z.object({
  id: RowId,
  product_name: ProductName,
  purchase_cost: EuroMoney,
  quantity: Quantity,
  associated_costs: EuroMoney,
  purchase_date: LocalDate.nullable(),
  created_at: z.string(),
});

export type CreateBuyInput = z.infer<typeof CreateBuyInput>;
export type UpdateBuyInput = z.infer<typeof UpdateBuyInput>;
export type Buy = z.infer<typeof Buy>;
