import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import { toastEliminado } from '../lib/toast.js';

export function useDeleteSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => soldsApi.remove(id),
    onSuccess: () => {
      toastEliminado('venta');
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
