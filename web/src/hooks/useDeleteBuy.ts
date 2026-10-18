import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';

export function useDeleteBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['buys'] });
    },
  });
}
