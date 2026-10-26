import { useCallback, useState } from 'react';
import { ApiError, apiErrorMessage } from '../api/client.js';
import type { AssociatedSale } from '../api/types.js';

interface CascadeMutation {
  mutateAsync: (id: number) => Promise<unknown>;
  isPending: boolean;
}

interface UseCascadeDeleteFlowOptions {
  id: number | null;
  resetKey: string | number | null;
  deleteOne: CascadeMutation;
  deleteCascade: CascadeMutation;
  canCascade?: boolean;
  onClose: () => void;
}

export interface CascadeDeleteFlow {
  inCascade: boolean;
  associatedSales: AssociatedSale[] | null;
  error: string | null;
  cascadeError: string | null;
  isCascading: boolean;
  confirm: () => Promise<void>;
  confirmCascade: () => Promise<void>;
  close: () => void;
  closeCascade: () => void;
}

type CascadeConflict = ApiError & { body: { associated_sales: AssociatedSale[] } };

export function isCascadeConflict(err: unknown): err is CascadeConflict {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as { associated_sales?: AssociatedSale[] };
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

export function useCascadeDeleteFlow({
  id,
  resetKey,
  deleteOne,
  deleteCascade,
  canCascade = true,
  onClose,
}: UseCascadeDeleteFlowOptions): CascadeDeleteFlow {
  const [inCascade, setInCascade] = useState(false);
  const [associatedSales, setAssociatedSales] = useState<AssociatedSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cascadeError, setCascadeError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState(resetKey);

  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setInCascade(false);
    setAssociatedSales(null);
    setError(null);
    setCascadeError(null);
  }

  const confirm = useCallback(async () => {
    if (id === null) return;
    setError(null);
    try {
      await deleteOne.mutateAsync(id);
      onClose();
    } catch (err) {
      if (canCascade && isCascadeConflict(err)) {
        setAssociatedSales(err.body.associated_sales);
        setInCascade(true);
        return;
      }
      setError(apiErrorMessage(err, 'Error al eliminar'));
    }
  }, [canCascade, deleteOne, id, onClose]);

  const confirmCascade = useCallback(async () => {
    if (id === null) return;
    setCascadeError(null);
    try {
      await deleteCascade.mutateAsync(id);
      onClose();
    } catch (err) {
      setCascadeError(apiErrorMessage(err, 'Error al eliminar en cascada'));
    }
  }, [deleteCascade, id, onClose]);

  const close = useCallback(() => {
    setError(null);
    setCascadeError(null);
    onClose();
  }, [onClose]);

  const closeCascade = useCallback(() => {
    if (deleteCascade.isPending) return;
    setCascadeError(null);
    onClose();
  }, [deleteCascade.isPending, onClose]);

  return {
    inCascade,
    associatedSales,
    error,
    cascadeError,
    isCascading: deleteCascade.isPending,
    confirm,
    confirmCascade,
    close,
    closeCascade,
  };
}
