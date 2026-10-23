import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { CreateBuyInput } from '../schemas/buys.js';
import { toastCreated } from '../lib/toast.js';

export function useCreateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBuyInput) => buysApi.create(input),
    onSuccess: (_data, input) => {
      toastCreated('buy', input.product_name);
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
