import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../api/sales.js';

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => salesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
