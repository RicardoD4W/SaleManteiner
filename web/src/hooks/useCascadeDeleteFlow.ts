import { useCallback, useState } from 'react';
import { ApiError, apiErrorMessage } from '../api/client.js';
import type { AssociatedSale } from '../api/types.js';

interface CascadeMutation {
  mutateAsync: (id: number) => Promise<unknown>;
  isPending: boolean;
}

interface UseCascadeDeleteFlowOptions {
  /** El registro que se quiere borrar (null si no hay nada abierto). */
  id: number | null;
  /** Cambia cuando cambia el objetivo: reinicia el flujo. */
  resetKey: string | number | null;
  deleteOne: CascadeMutation;
  deleteCascade: CascadeMutation;
  /** Si el recurso no tiene borrado en cascada, un 409 se muestra como error. */
  canCascade?: boolean;
  onClose: () => void;
}

export interface CascadeDeleteFlow {
  /** ¿Está abierta la modal de cascada (el 409 ya llegó)? */
  inCascade: boolean;
  /** Las ventas asociadas que manda el 409. */
  associatedSales: AssociatedSale[] | null;
  /** El error del borrado simple. */
  error: string | null;
  /** El error del borrado en cascada. */
  cascadeError: string | null;
  /** ¿Está en curso el borrado en cascada? */
  isCascading: boolean;
  confirm: () => Promise<void>;
  confirmCascade: () => Promise<void>;
  close: () => void;
  closeCascade: () => void;
}

type CascadeConflict = ApiError & { body: { associated_sales: AssociatedSale[] } };

/** El 409 del server: el registro tiene ventas asociadas y no se puede borrar solo. */
export function isCascadeConflict(err: unknown): err is CascadeConflict {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as { associated_sales?: AssociatedSale[] };
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

/**
 * El flujo de borrar en cascada, igual para compras, ventas y clientes:
 * confirmar → (409 con ventas) → la modal de cascada → confirmar la cascada.
 */
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

  // Si cambia el objetivo, el flujo vuelve a empezar (sin el parpadeo de un effect).
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
