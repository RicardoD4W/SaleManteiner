import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { CreateBuyInput } from '../schemas/buys.js';
import { toastRegistrado } from '../lib/toast.js';

export function useCreateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBuyInput) => buysApi.create(input),
    onSuccess: (_data, input) => {
      toastRegistrado('compra', input.product_name);
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
