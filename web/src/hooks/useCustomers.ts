import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.list,
  });
}
