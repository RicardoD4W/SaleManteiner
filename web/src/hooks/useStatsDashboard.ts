import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

/**
 * Hook que envuelve GET /api/stats/dashboard con React Query.
 * Cache compartido (staleTime 60s en el queryClient) — al navegar entre tabs
 * del dashboard no se re-fetchea.
 */
export function useStatsDashboard() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => soldsApi.dashboardStats(),
  });
}
