import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import type { CreateCustomerInput } from '../schemas/customers.js';
import { toastCreated } from '../lib/toast.js';
import { invalidate } from '../lib/queryClient';

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => customersApi.create(input),
    onSuccess: (data) => {
      toastCreated('customer', data.name);
      invalidate(qc, ['customers']);
    },
  });
}
