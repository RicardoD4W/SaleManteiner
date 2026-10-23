import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import type { CreateSoldInput } from '../schemas/solds.js';
import { toastCreated } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useCreateSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSoldInput) => soldsApi.create(input),
    onSuccess: () => {
      toastCreated('sale');
      invalidate(qc, ['solds'], ['buys'], ['stats', 'dashboard']);
    },
  });
}
