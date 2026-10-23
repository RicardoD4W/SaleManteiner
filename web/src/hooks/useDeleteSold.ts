import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import { toastDeleted } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useDeleteSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => soldsApi.remove(id),
    onSuccess: () => {
      toastDeleted('sale');
      invalidate(qc, ['solds'], ['buys'], ['stats', 'dashboard']);
    },
  });
}
