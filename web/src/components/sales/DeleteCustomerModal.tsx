import { DeleteCascadeModal } from './DeleteCascadeModal';
import { formatDate } from '../../lib/format';
import type { AssociatedSale } from '../../api/types';

interface DeleteCustomerModalProps {
  customerName: string;
  sales: AssociatedSale[];
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
  const items = sales.map((sale) => {
    const unitLabel = sale.items_count === 1 ? 'unidad' : 'unidades';
    return {
      id: sale.id,
      title: `Venta #${sale.id}`,
      description: `${sale.customer_name} · ${formatDate(sale.sold_at)}`,
      badge: `× ${sale.items_count} ${unitLabel}`,
    };
  });

  return (
    <DeleteCascadeModal
      title="El cliente tiene ventas asociadas"
      entityName={customerName}
      entityPhrase="El cliente"
      entityPronoun="lo"
      confirmLabel="Borrar también las ventas y el cliente"
      countLabelSingular="venta registrada"
      countLabelPlural="ventas registradas"
      itemsNoun="las ventas"
      items={items}
      isPending={isPending}
      cascadeError={cascadeError}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
