import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import { toastDeleted } from '../lib/toast.js';

export function useDeleteBuyCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.removeCascade(id),
    onSuccess: () => {
      toastDeleted('buy');
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
