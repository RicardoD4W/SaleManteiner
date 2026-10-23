import { useState } from 'react';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DeleteBuyModal } from './DeleteBuyModal';
import { useDeleteBuy, isDeleteBuy409 } from '../../hooks/useDeleteBuy';
import type { AssociatedSale } from '../../api/types';
import { useDeleteBuyCascade } from '../../hooks/useDeleteBuyCascade';
import { useDeleteSold } from '../../hooks/useDeleteSold';
import { apiErrorMessage } from '../../api/client';

export type DeleteTarget =
  { kind: 'buy'; id: number; name: string } | { kind: 'sale'; id: number } | null;

type DeleteRecord = Exclude<DeleteTarget, null>;

interface DeleteDialogsProps {
  target: DeleteTarget;

  onClose: () => void;
}

export function DeleteDialogs({ target, onClose }: DeleteDialogsProps) {
  if (target === null) return null;
  const targetKey = `${target.kind}:${target.id}`;
  return <DeleteDialogsFlow key={targetKey} target={target} onClose={onClose} />;
}

function DeleteDialogsFlow({ target, onClose }: { target: DeleteRecord; onClose: () => void }) {
  const deleteBuy = useDeleteBuy();
  const deleteBuyCascade = useDeleteBuyCascade();
  const deleteSold = useDeleteSold();

  const [inCascade, setInCascade] = useState(false);

  const [associatedSales, setAssociatedSales] = useState<AssociatedSale[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [cascadeError, setCascadeError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      if (target.kind === 'buy') {
        await deleteBuy.mutateAsync(target.id);
      } else {
        await deleteSold.mutateAsync(target.id);
      }
      onClose();
    } catch (err) {
      if (target.kind === 'buy' && isDeleteBuy409(err)) {
        setAssociatedSales(err.body.associated_sales);
        setInCascade(true);
        return;
      }
      setError(apiErrorMessage(err, 'Error al eliminar'));
    }
  };

  const handleCascadeConfirm = async () => {
    if (target.kind !== 'buy') return;
    setCascadeError(null);
    try {
      await deleteBuyCascade.mutateAsync(target.id);
      onClose();
    } catch (err) {
      setCascadeError(apiErrorMessage(err, 'Error al eliminar en cascada'));
    }
  };

  const handleClose = () => {
    setError(null);
    setCascadeError(null);
    onClose();
  };

  const handleCascadeClose = () => {
    if (deleteBuyCascade.isPending) return;
    setCascadeError(null);
    onClose();
  };

  if (inCascade && associatedSales && target.kind === 'buy') {
    return (
      <DeleteBuyModal
        productName={target.name}
        sales={associatedSales}
        isPending={deleteBuyCascade.isPending}
        cascadeError={cascadeError}
        onClose={handleCascadeClose}
        onConfirm={handleCascadeConfirm}
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
      error={error}
      isPending={target.kind === 'buy' ? deleteBuy.isPending : deleteSold.isPending}
      confirmLabel="Sí, eliminar"
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}
