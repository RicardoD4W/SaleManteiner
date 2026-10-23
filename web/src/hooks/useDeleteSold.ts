import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import { toastDeleted } from '../lib/toast.js';

export function useDeleteSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => soldsApi.remove(id),
    onSuccess: () => {
      toastDeleted('sale');
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
