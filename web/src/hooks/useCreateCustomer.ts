import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import type { CreateCustomerInput } from '../schemas/customers.js';
import { toastRegistrado } from '../lib/toast.js';

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => customersApi.create(input),
    onSuccess: (data) => {
      toastRegistrado('cliente', data.name);
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
