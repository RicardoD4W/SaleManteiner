import { DeleteCascadeModal } from './DeleteCascadeModal';
import { formatDate } from '../../lib/format';
import type { AssociatedSale } from '../../api/types';

interface DeleteBuyModalProps {
  productName: string;
  sales: AssociatedSale[];
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
      title="La compra tiene ventas asociadas"
      entityName={productName}
      entityPhrase="La compra"
      entityPronoun="la"
      confirmLabel="Borrar también las ventas y la compra"
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
