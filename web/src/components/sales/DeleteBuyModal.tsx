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
