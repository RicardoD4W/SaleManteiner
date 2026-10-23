import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { UpdateBuyInput } from '../schemas/buys.js';
import { toastUpdated } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useUpdateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateBuyInput }) => buysApi.update(id, input),
    onSuccess: (data) => {
      toastUpdated('buy', data.product_name);
      invalidate(qc, ['buys'], ['stats', 'dashboard']);
      qc.setQueryData(['buys', data.id], data);
    },
  });
}
