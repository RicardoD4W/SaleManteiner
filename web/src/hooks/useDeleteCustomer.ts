import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import { ApiError } from '../api/client';
import { toastDeleted } from '../lib/toast.js';
import type { AssociatedSale } from '../api/types';
import { invalidate } from '../lib/queryClient';

type DeleteCustomer409Body = {
  error: string;
  associated_sales: AssociatedSale[];
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
      invalidate(qc, ['customers'], ['stats', 'dashboard']);
    },
  });
}

export function useDeleteCustomerCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customersApi.removeCascade(id),
    onSuccess: () => {
      toastDeleted('customer');
      invalidate(qc, ['customers'], ['solds'], ['stats', 'dashboard']);
    },
  });
}
