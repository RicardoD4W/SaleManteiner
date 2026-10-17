import { useQuery } from '@tanstack/react-query';
import { salesApi } from '../api/sales.js';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: salesApi.stats,
  });
}
