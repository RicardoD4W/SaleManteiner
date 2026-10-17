import { useQuery } from '@tanstack/react-query';
import { salesApi, type DashboardStats } from '../api/sales.js';

/**
 * Hook del dashboard (Fase 5). Cache 60s para que navegar entre tabs
 * (Overview / Revenue / Products) no re-fetch el payload entero.
 * Si en el futuro agregás un import o creás una venta, el caller debe
 * invalidar con `qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] })`.
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => salesApi.dashboardStats(),
    staleTime: 60_000,
  });
}
