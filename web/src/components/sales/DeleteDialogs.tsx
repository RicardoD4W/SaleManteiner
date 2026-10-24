import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DeleteBuyModal } from './DeleteBuyModal';
import { useDeleteBuy } from '../../hooks/useDeleteBuy';
import { useDeleteBuyCascade } from '../../hooks/useDeleteBuyCascade';
import { useDeleteSold } from '../../hooks/useDeleteSold';
import { useCascadeDeleteFlow } from '../../hooks/useCascadeDeleteFlow';

export type DeleteTarget =
  { kind: 'buy'; id: number; name: string } | { kind: 'sale'; id: number } | null;

type DeleteRecord = Exclude<DeleteTarget, null>;

interface DeleteDialogsProps {
  target: DeleteTarget;

  onClose: () => void;
}

export function DeleteDialogs({ target, onClose }: DeleteDialogsProps) {
  if (target === null) return null;
  return <DeleteDialogsFlow target={target} onClose={onClose} />;
}

function DeleteDialogsFlow({ target, onClose }: { target: DeleteRecord; onClose: () => void }) {
  const deleteBuy = useDeleteBuy();
  const deleteBuyCascade = useDeleteBuyCascade();
  const deleteSold = useDeleteSold();

  const flow = useCascadeDeleteFlow({
    id: target.id,
    resetKey: `${target.kind}:${target.id}`,
    deleteOne: target.kind === 'buy' ? deleteBuy : deleteSold,
    deleteCascade: deleteBuyCascade,
    onClose,
  });

  if (flow.inCascade && flow.associatedSales && target.kind === 'buy') {
    return (
      <DeleteBuyModal
        productName={target.name}
        sales={flow.associatedSales}
        isPending={flow.isCascading}
        cascadeError={flow.cascadeError}
        onClose={flow.closeCascade}
        onConfirm={flow.confirmCascade}
      />
    );
  }

  return (
    <ConfirmDeleteModal
      title={target.kind === 'buy' ? 'Eliminar compra' : 'Eliminar venta'}
      description={
        target.kind === 'buy' ? (
          <>
            ¿Eliminar <strong>"{target.name}"</strong>? No se puede deshacer.
          </>
        ) : (
          <>¿Eliminar esta venta? No se puede deshacer.</>
        )
      }
      error={flow.error}
      isPending={target.kind === 'buy' ? deleteBuy.isPending : deleteSold.isPending}
      confirmLabel="Sí, eliminar"
      onClose={flow.close}
      onConfirm={flow.confirm}
    />
  );
}
