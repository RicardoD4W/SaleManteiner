import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import type { UpdateCustomerInput } from '../schemas/customers.js';

/**
 * Hook que envuelve `PATCH /api/customers/:id` con React Query.
 *
 * En éxito invalida:
 *  - `['customers']`: la lista de clientes (el nombre pudo cambiar).
 *  - `['stats', 'dashboard']`: el dashboard muestra `topBuyers` con el
 *    nombre del cliente; sin invalidar, sus KPIs quedan congelados con el
 *    nombre viejo.
 *
 * El nombre del cliente se resuelve por id (L6 del feature clientes-crud):
 * renombrar un cliente NO toca sus ventas, así que no hace falta invalidar
 * `['solds']`.
 */
export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCustomerInput }) =>
      customersApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
