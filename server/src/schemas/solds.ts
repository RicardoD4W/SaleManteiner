/**
 * Schemas Zod para ventas (solds).
 *
 * Principios aplicados (skill zod): ver buys.ts.
 *
 * Modelo de datos (S1 del feature):
 *  - sale_price y associated_costs son TOTALES de la venta (no por item del pack).
 *  - sale_price >= 0 (CHECK en SQL; Zod valida nonnegative).
 *  - sold_at es opcional (fecha de venta, default hoy en el form).
 *  - notes es nullable (opcional, solo en venta).
 *  - customer_id es requerido (ON DELETE RESTRICT → no se puede vender a un cliente eliminado).
 *
 * Pack / items (S5 del feature):
 *  - La venta se crea con un array de items [{ buy_id, quantity }].
 *  - La validación de stock (S7) se hace en el repo dentro de db.transaction.
 *  - El cálculo de beneficio (S13) se hace en el repo al listar/detallar ventas.
 */
import { z } from 'zod';
import { EuroMoney, LocalDate, RowId, LongText } from './common.js';

const Quantity = z.number().int().min(1);

/** Un item del pack: referencia a una compra previa + cantidad vendida. */
export const SaleItemInput = z
  .object({
    buy_id: RowId,
    quantity: Quantity,
  })
  .strict();

export type SaleItemInput = z.infer<typeof SaleItemInput>;

export const CreateSoldInput = z
  .object({
    customer_id: RowId,
    sale_price: EuroMoney.optional().default(0),
    associated_costs: EuroMoney.optional().default(0),
    sold_at: LocalDate.optional(),
    notes: LongText.nullable().optional(),
    /** Items del pack (al menos 1). */
    items: z.array(SaleItemInput).min(1),
  })
  .strict();

export const UpdateSoldInput = z
  .object({
    customer_id: RowId.optional(),
    sale_price: z.number().nonnegative().optional(),
    associated_costs: z.number().nonnegative().optional(),
    sold_at: LocalDate.nullable().optional(),
    notes: LongText.nullable().optional(),
  })
  .strict();

/** Output: nullable para sold_at, notes (pueden ser null en BD). */
export const Sold = z.object({
  id: RowId,
  customer_id: RowId,
  sale_price: EuroMoney,
  associated_costs: EuroMoney,
  sold_at: LocalDate.nullable(),
  notes: LongText.nullable(),
  created_at: z.string(),
});

export type CreateSoldInput = z.infer<typeof CreateSoldInput>;
export type UpdateSoldInput = z.infer<typeof UpdateSoldInput>;
export type Sold = z.infer<typeof Sold>;

/** Un item del pack en el output (incluye datos derivados del buy). */
export interface SaleItemOutput {
  buy_id: number;
  product_name: string;
  quantity: number;
  /** Coste unitario prorrateado = round2(purchase_cost / quantity). */
  unit_cost: number;
  /** Gastos asociados unitarios prorrateados = round2(associated_costs / quantity). */
  unit_assoc: number;
}

/** Venta con sus items (para GET /solds/:id). */
export interface SoldWithItems extends Sold {
  customer_name: string;
  items: SaleItemOutput[];
}
