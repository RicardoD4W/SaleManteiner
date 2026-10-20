import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import { ApiError } from '../api/client';

/** Venta asociada a un buy en el body del 409. Mirror del server. */
export interface AssociatedSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

/** Body del 409 que devuelve `DELETE /api/buys/:id` cuando hay ventas asociadas. */
export type DeleteBuy409Body = {
  error: string;
  associated_sales: AssociatedSale[];
};

/**
 * Type guard para errores 409 del delete normal. Lo usa la página de
 * edición de compra para abrir el modal de confirmación cascade cuando
 * el server rechaza el delete simple.
 *
 * Accede al body parseado del `ApiError`. La razón: la estructura de
 * `ApiError.body` está declarada como `{ error: string; issues?: unknown }`
 * en `client.ts`, pero el server ya manda `{ error, associated_sales }` y
 * `apiFetch` parsea el JSON completo (`res.json()`), así que en runtime
 * la propiedad está accesible — solo hace falta un predicado de tipo para
 * que TS la vea sin tocar `client.ts`.
 *
 * S11: NO alcanza con mirar el status. Un 409 sin `associated_sales` (o con
 * la lista vacía) no se puede confirmar en cascada: si el guard lo aceptaba,
 * la modal no se renderizaba y el error tampoco se mostraba → el click en
 * "Eliminar" no hacía nada. Con este guard, ese caso cae en el `else` de la
 * página y el mensaje de error del server se muestra.
 */
export function isDeleteBuy409(err: unknown): err is ApiError & { body: DeleteBuy409Body } {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as Partial<DeleteBuy409Body>;
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

export function useDeleteBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['buys'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'dashboard'] });
    },
  });
}
