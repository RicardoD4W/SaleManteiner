import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
