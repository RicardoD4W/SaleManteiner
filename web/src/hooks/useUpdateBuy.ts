import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { UpdateBuyInput } from '../schemas/buys.js';
import { toastActualizado } from '../lib/toast.js';

export function useUpdateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateBuyInput }) => buysApi.update(id, input),
    onSuccess: (data) => {
      toastActualizado('compra', data.product_name);
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
      qc.setQueryData(['buys', data.id], data);
    },
  });
}
