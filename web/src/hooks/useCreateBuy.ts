import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { CreateBuyInput } from '../schemas/buys.js';

export function useCreateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBuyInput) => buysApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
