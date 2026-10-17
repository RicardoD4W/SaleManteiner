import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi, type ImportResult } from '../api/sales.js';
import type { CreateSaleInput } from '../schemas/sales.js';

/**
 * Hook para importación CSV (Fase 3). Mismo patrón que `useCreateSale`: usa
 * `useMutation` y al éxito invalida `sales` y `stats` para forzar refetch.
 *
 * El caller es responsable de parsear el CSV, validar fila por fila con
 * `CreateSaleInput.safeParse` y mostrar el preview. Si el cliente deja pasar
 * una fila inválida, el server responde 422 y React Query lo expone como
 * `error` (lo captura `ApiError` en el caller).
 */
export function useImportSales() {
  const qc = useQueryClient();
  return useMutation<ImportResult, Error, CreateSaleInput[]>({
    mutationFn: (sales: CreateSaleInput[]) => salesApi.import(sales),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      return data;
    },
  });
}
