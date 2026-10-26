import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import { toastDeleted } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useDeleteBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.remove(id),
    onSuccess: () => {
      toastDeleted('buy');
      invalidate(qc, ['buys'], ['stats', 'dashboard']);
    },
  });
}
