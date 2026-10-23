import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import { ApiError } from '../api/client';
import { toastDeleted } from '../lib/toast.js';

export interface AssociatedCustomerSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

export type DeleteCustomer409Body = {
  error: string;
  associated_sales: AssociatedCustomerSale[];
};

export function isDeleteCustomer409(
  err: unknown,
): err is ApiError & { body: DeleteCustomer409Body } {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as Partial<DeleteCustomer409Body>;
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customersApi.remove(id),
    onSuccess: () => {
      toastDeleted('customer');
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}

export function useDeleteCustomerCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customersApi.removeCascade(id),
    onSuccess: () => {
      toastDeleted('customer');
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
