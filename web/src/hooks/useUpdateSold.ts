import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import type { UpdateSoldInput } from '../schemas/solds.js';
import { toastUpdated } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useUpdateSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSoldInput }) =>
      soldsApi.update(id, input),
    onSuccess: (data) => {
      toastUpdated('sale');
      invalidate(qc, ['solds'], ['stats', 'dashboard']);
      qc.setQueryData(['solds', data.id], data);
    },
  });
}
