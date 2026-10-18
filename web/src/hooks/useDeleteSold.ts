import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

export function useDeleteSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => soldsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['buys'] });
    },
  });
}
