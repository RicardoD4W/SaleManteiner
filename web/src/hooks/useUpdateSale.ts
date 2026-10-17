import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../api/sales.js';
import type { UpdateSaleInput } from '../schemas/sales.js';

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSaleInput }) =>
      salesApi.update(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      qc.setQueryData(['sales', data.id], data);
    },
  });
}
