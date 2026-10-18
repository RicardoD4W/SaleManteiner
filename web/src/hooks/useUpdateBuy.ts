import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import type { UpdateBuyInput } from '../schemas/buys.js';

export function useUpdateBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateBuyInput }) =>
      buysApi.update(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['buys'] });
      qc.setQueryData(['buys', data.id], data);
    },
  });
}
