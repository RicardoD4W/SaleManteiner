import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';

/**
 * Hook de mutación para el cascade delete de compras (`DELETE
 * /api/buys/:id/cascade`). Borra la compra y limpia sus ventas
 * asociadas. Invalida `['buys']` (la compra desapareció) y `['solds']`
 * (algunas ventas pueden haber cambiado: items removidos o ventas
 * enteras borradas).
 *
 * Usado por la modal de confirmación cascade en la página de edición de
 * compra cuando el `DELETE /api/buys/:id` simple devuelve 409.
 */
export function useDeleteBuyCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.removeCascade(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['solds'] });
    },
  });
}
