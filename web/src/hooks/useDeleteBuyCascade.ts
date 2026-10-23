import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import { toastDeleted } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useDeleteBuyCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.removeCascade(id),
    onSuccess: () => {
      toastDeleted('buy');
      invalidate(qc, ['buys'], ['solds'], ['stats', 'dashboard']);
    },
  });
}
