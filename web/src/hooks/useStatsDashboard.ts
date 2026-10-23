import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

export function useStatsDashboard() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => soldsApi.dashboardStats(),
  });
}
