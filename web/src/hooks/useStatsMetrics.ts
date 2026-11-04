import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

export function useStatsMetrics() {
  return useQuery({
    queryKey: ['stats', 'metrics'],
    queryFn: () => soldsApi.metricsStats(),
  });
}
