import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

export function useSold(id: number) {
  return useQuery({
    queryKey: ['solds', id],
    queryFn: () => soldsApi.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
