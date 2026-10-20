import { useMutation, useQueryClient } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';
import type { UpdateSoldInput } from '../schemas/solds.js';

export function useUpdateSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateSoldInput }) =>
      soldsApi.update(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
      qc.setQueryData(['solds', data.id], data);
    },
  });
}
