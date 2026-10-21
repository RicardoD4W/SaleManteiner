/**
 * Modal de confirmación del borrado en cascada de un CLIENTE (S3 del
 * feature `clientes-crud`).
 *
 * Se muestra cuando `DELETE /api/customers/:id` devuelve 409 (el cliente
 * tiene ventas asociadas). Es el diálogo compartido `DeleteCascadeModal`
 * con el texto de los clientes: el markup vive una sola vez (lo usan
 * también las compras).
 *
 * Accesibilidad (WCAG 2.2): el foco, el cierre y el anuncio del error los
 * aporta `DeleteCascadeModal` (focus trap, Escape, backdrop y
 * `role="alert"`).
 */
import { DeleteCascadeModal, type CascadeSale } from './DeleteCascadeModal';

export interface DeleteCustomerModalProps {
  /** Nombre del cliente que se va a borrar. */
  customerName: string;
  /** Ventas asociadas (body del 409). */
  sales: CascadeSale[];
  /** `true` mientras el borrado en cascada está en curso. */
  isPending: boolean;
  /** Error del borrado en cascada (red, 5xx). Se muestra en la modal. */
  cascadeError: string | null;
  /** Cierre (Escape, backdrop o "Cancelar"). */
  onClose: () => void;
  /** Confirmación del borrado en cascada. */
  onConfirm: () => void;
}

export function DeleteCustomerModal({
  customerName,
  sales,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteCustomerModalProps) {
  return (
    <DeleteCascadeModal
      title="El cliente tiene ventas asociadas"
      entityName={customerName}
      entityPhrase="El cliente"
      entityPronoun="lo"
      confirmLabel="Borrar también las ventas y el cliente"
      sales={sales}
      isPending={isPending}
      cascadeError={cascadeError}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
