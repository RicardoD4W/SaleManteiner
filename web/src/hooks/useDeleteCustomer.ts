import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import { toastDeleted } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

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
