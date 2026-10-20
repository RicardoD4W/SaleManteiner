import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import type { CreateSoldInput } from '../schemas/solds.js';

export function useCreateSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSoldInput) => soldsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
