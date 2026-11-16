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

  const salesCount = sales.length;
  const countLabel = salesCount === 1 ? 'venta registrada' : 'ventas registradas';
  const description =
    `La compra "${productName}" tiene ${salesCount} ${countLabel}. ` +
    `Si borrás la compra, las ventas que solo contenían sus productos se borran; ` +
    `las que tenían más productos se quedan y su importe (precio, gastos e importe cobrado) ` +
    `se ajusta a la parte que queda. Esta acción no se puede deshacer.`;
  const note =
    'Las ventas que quedan con otros productos no cambian de cliente ni de fecha: ' +
    'solo se recalculan sus importes.';

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
      description={description}
      note={note}
      isPending={isPending}
      cascadeError={cascadeError}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
