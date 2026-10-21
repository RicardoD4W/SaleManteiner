/**
 * Modal de confirmación del borrado en cascada de una COMPRA (S2 del
 * feature `acciones-en-listas`).
 *
 * Se muestra cuando `DELETE /api/buys/:id` devuelve 409 (la compra tiene
 * ventas asociadas). Es el diálogo compartido `DeleteCascadeModal` con el
 * texto de las compras: el markup vive una sola vez (lo usan también los
 * clientes).
 *
 * Accesibilidad (WCAG 2.2): el foco, el cierre y el anuncio del error los
 * aporta `DeleteCascadeModal` (focus trap, Escape, backdrop y
 * `role="alert"`).
 */
import { DeleteCascadeModal, type CascadeSale } from './DeleteCascadeModal';

export interface DeleteBuyModalProps {
  productName: string;
  sales: CascadeSale[];
  isPending: boolean;
  cascadeError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteBuyModal({
  productName,
  sales,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteBuyModalProps) {
  return (
    <DeleteCascadeModal
      title="La compra tiene ventas asociadas"
      entityName={productName}
      entityPhrase="La compra"
      entityPronoun="la"
      confirmLabel="Borrar también las ventas y la compra"
      sales={sales}
      isPending={isPending}
      cascadeError={cascadeError}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
