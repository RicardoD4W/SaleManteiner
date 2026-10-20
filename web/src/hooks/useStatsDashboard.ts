import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

/**
 * Hook que envuelve GET /api/stats/dashboard con React Query.
 *
 * Cache compartido: con `staleTime: Infinity` en el queryClient no se
 * re-fetchea al navegar entre tabs del dashboard; se refresca solo cuando
 * una mutación invalida la clave `['stats', 'dashboard']` (comprar, vender,
 * editar o borrar).
 */
export function useStatsDashboard() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => soldsApi.dashboardStats(),
  });
}
