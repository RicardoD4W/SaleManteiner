/**
 * Helper de redondeo a 2 decimales para importes en euros decimales.
 *
 * Mitiga el error IEEE 754 en sumas/restas/multiplicaciones de números
 * decimales de punto flotante. Sin esto:
 *   0.1 + 0.2 → 0.30000000000000004
 *   0.06 * 5  → 0.30000000000000004
 * Con `round2`:
 *   round2(0.1 + 0.2) → 0.30
 *   round2(0.06 * 5)  → 0.30
 *
 * Riesgo residual conocido (S2 del feature): a alto volumen (miles de
 * operaciones en cadena) podría haber un descuadre acumulado de ±0.01€.
 * Aceptable a ~50 ventas/mes.
 *
 * Aplicar `round2()` en:
 *   - Toda suma/resta/multiplicación que toque un importe.
 *   - Cálculo de unit_cost = round2(purchase_cost / quantity).
 *   - Cálculo de unit_assoc = round2(associated_costs / quantity).
 *   - Cálculo de beneficio por venta (S13 del feature).
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Tipo para importes en euros (número redondeado a 2 decimales). */
export type Euro = number;
