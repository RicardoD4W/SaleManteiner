import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.js';
import { ApiError } from '../api/client';
import { toastEliminado } from '../lib/toast.js';

/**
 * Borrado de clientes (S3 del feature `clientes-crud`).
 *
 * El server responde:
 *  - `DELETE /api/customers/:id` → 204 si el cliente no tiene ventas.
 *  - `DELETE /api/customers/:id` → 409 con `{ error, associated_sales }` si
 *    tiene ventas (y NO borra nada).
 *  - `DELETE /api/customers/:id/cascade` → 204: borra el cliente, sus
 *    ventas y los `sale_items` de esas ventas (en una transacción).
 */

/** Venta asociada a un cliente en el body del 409. Mirror del server. */
export interface AssociatedCustomerSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

/** Body del 409 que devuelve `DELETE /api/customers/:id`. */
export type DeleteCustomer409Body = {
  error: string;
  associated_sales: AssociatedCustomerSale[];
};

/**
 * Type guard para errores 409 del borrado simple de un cliente. Lo usa la
 * vista de Clientes para abrir la modal de confirmación en cascada cuando
 * el server rechaza el borrado simple.
 *
 * Es el mismo patrón estricto que `isDeleteBuy409` (S11 del feature
 * `delete-cascade-and-ux-polish`): NO alcanza con mirar el status. Un 409
 * sin `associated_sales` (o con la lista vacía) no se puede confirmar en
 * cascada — si el guard lo aceptara, la modal no se renderizaría y el
 * error tampoco se mostraría → el click en "Borrar" no haría nada. Con este
 * guard, ese caso cae en el `else` de la página y el mensaje de error del
 * server se muestra.
 *
 * Accede al body parseado del `ApiError`. La razón: la estructura de
 * `ApiError.body` está declarada como `{ error: string; issues?: unknown }`
 * en `client.ts`, pero el server ya manda `{ error, associated_sales }` y
 * `apiFetch` parsea el JSON completo, así que en runtime la propiedad está
 * accesible — solo hace falta un predicado de tipo para que TS la vea sin
 * tocar `client.ts`.
 */
export function isDeleteCustomer409(
  err: unknown,
): err is ApiError & { body: DeleteCustomer409Body } {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as Partial<DeleteCustomer409Body>;
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

/**
 * Borrado simple de un cliente (`DELETE /api/customers/:id`).
 *
 * Solo funciona si el cliente NO tiene ventas; si las tiene, el server
 * responde 409 y no borra nada (el flujo lo convierte en una cascada
 * confirmada por el usuario).
 *
 * En éxito invalida:
 *  - `['customers']`: el cliente desapareció de la lista.
 *  - `['stats','dashboard']`: el dashboard muestra `topBuyers` con el
 *    nombre del cliente.
 */
export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customersApi.remove(id),
    onSuccess: () => {
      toastEliminado('cliente');
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}

/**
 * Borrado en cascada de un cliente (`DELETE /api/customers/:id/cascade`).
 *
 * Borra el cliente, sus ventas y los `sale_items` de esas ventas. En éxito
 * invalida:
 *  - `['customers']`: el cliente desapareció de la lista.
 *  - `['solds']`: sus ventas desaparecieron (y con ellas, los items).
 *  - `['stats','dashboard']`: el dashboard muestra `topBuyers` con el
 *    nombre del cliente y sus KPIs cambian.
 */
export function useDeleteCustomerCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customersApi.removeCascade(id),
    onSuccess: () => {
      toastEliminado('cliente');
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['solds'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
