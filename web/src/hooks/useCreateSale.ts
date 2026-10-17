import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../api/sales.js';
import type { CreateSaleInput } from '../schemas/sales.js';

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSaleInput) => salesApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
