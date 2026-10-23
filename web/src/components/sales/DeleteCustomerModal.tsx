import { DeleteCascadeModal, type CascadeSale } from './DeleteCascadeModal';

export interface DeleteCustomerModalProps {
  customerName: string;

  sales: CascadeSale[];

  isPending: boolean;

  cascadeError: string | null;

  onClose: () => void;

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
