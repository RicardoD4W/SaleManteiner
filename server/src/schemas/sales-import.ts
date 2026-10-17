/**
 * Schema del body del endpoint POST /api/sales/import (Fase 3).
 *
 * Reglas:
 *  - Cada fila se valida con el mismo CreateSaleInput que usa el POST individual,
 *    garantizando que un CSV impuro no se cuele a la BD.
 *  - Mínimo 1 fila: un CSV "vacío" no es una importación válida (el cliente
 *    no debería siquiera mandar la request).
 *  - Máximo 1000 filas por llamada. CSVs más grandes se rechazan acá para
 *    proteger la BD de inserciones masivas accidentales. Si el usuario tiene
 *    un CSV de 5000 filas, debe dividirlo en batches desde la UI.
 *  - Atomicidad: si UNA fila falla el schema, NO se importa NINGUNA. La
 *    garantía la da `db.transaction` en el repo (ver `sales-repo.ts`),
 *    pero el parse previo con Zod descarta el batch entero si hay issues.
 */
import { z } from 'zod';
import { RowId } from './common.js';
import { CreateSaleInput } from './sales.js';

export const ImportSalesInput = z
  .object({
    sales: z
      .array(CreateSaleInput)
      .min(1, 'El CSV no tiene filas para importar.')
      .max(1000, 'El CSV excede el máximo de 1000 filas por llamada. Dividilo en batches.'),
  })
  .strict();

/** Respuesta del endpoint de import exitoso (sale del repo agrupado en ids). */
export const ImportSalesOutput = z.object({
  imported: z.number().int().positive(),
  ids: z.array(RowId),
});

export type ImportSalesInput = z.infer<typeof ImportSalesInput>;
export type ImportSalesOutput = z.infer<typeof ImportSalesOutput>;
