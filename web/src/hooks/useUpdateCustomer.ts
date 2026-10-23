import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import { toastUpdated } from '../lib/toast.js';
import type { UpdateCustomerInput } from '../schemas/customers.js';
import { invalidate } from '../lib/queryClient';

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCustomerInput }) =>
      customersApi.update(id, input),
    onSuccess: (_data, variables) => {
      toastUpdated('customer', variables.input.name);
      invalidate(qc, ['customers'], ['stats', 'dashboard']);
    },
  });
}
