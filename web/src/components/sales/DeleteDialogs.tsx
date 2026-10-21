/**
 * Flujo de borrado desde las tablas (S1 y S2 del feature
 * `acciones-en-listas`).
 *
 * Concentra los dos pasos del borrado y se renderiza a NIVEL DE PÁGINA
 * (no dentro de la fila): las filas de la tabla virtualizada tienen
 * `transform: translateY(...)` y un ancestro con transform convierte
 * `position: fixed` en `absolute` → una modal renderizada dentro de la
 * celda aparecería desplazada y recortada.
 *
 * Paso 1: `ConfirmDeleteModal` (confirmación simple).
 *  - Compra: `DELETE /api/buys/:id`. Si el server responde 409 (tiene
 *    ventas asociadas) → paso 2.
 *  - Venta: `DELETE /api/solds/:id`. No tiene cascada.
 * Paso 2: `DeleteBuyModal` (doble confirmación) →
 *  `DELETE /api/buys/:id/cascade`.
 *
 * Los hooks (`useDeleteBuy`, `useDeleteBuyCascade`, `useDeleteSold`) son los
 * del repo: ya disparan el toast y invalidan la caché.
 */
import { useState } from 'react';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DeleteBuyModal } from './DeleteBuyModal';
import { useDeleteBuy, isDeleteBuy409, type AssociatedSale } from '../../hooks/useDeleteBuy';
import { useDeleteBuyCascade } from '../../hooks/useDeleteBuyCascade';
import { useDeleteSold } from '../../hooks/useDeleteSold';
import { ApiError } from '../../api/client';

/** Registro que se va a borrar. `null` = no hay nada que borrar. */
export type DeleteTarget =
  { tipo: 'compra'; id: number; nombre: string } | { tipo: 'venta'; id: number } | null;

/** Registro concreto (sin `null`). */
export type DeleteRecord = Exclude<DeleteTarget, null>;

export interface DeleteDialogsProps {
  /** Registro a borrar (o `null` para no mostrar nada). */
  target: DeleteTarget;
  /** Cierra el flujo (borrado hecho o cancelado). */
  onClose: () => void;
}

/** Extrae el mensaje de un error de la API. */
function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.body.error;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function DeleteDialogs({ target, onClose }: DeleteDialogsProps) {
  if (target === null) return null;
  // La `key` reinicia el flujo cuando cambia el registro: el estado (paso,
  // errores) de una fila no puede filtrarse a la siguiente. Es el patrón
  // de React para "resetear estado con una key" (en vez de un efecto con
  // setState, que provoca renders en cascada).
  const targetKey = `${target.tipo}:${target.id}`;
  return <DeleteDialogsFlow key={targetKey} target={target} onClose={onClose} />;
}

function DeleteDialogsFlow({ target, onClose }: { target: DeleteRecord; onClose: () => void }) {
  const deleteBuy = useDeleteBuy();
  const deleteBuyCascade = useDeleteBuyCascade();
  const deleteSold = useDeleteSold();

  /** Paso 2 = la compra tiene ventas asociadas y hay que confirmar la cascada. */
  const [enCascada, setEnCascada] = useState(false);
  /** Ventas asociadas del 409 (para listar en la modal de cascada). */
  const [ventasAsociadas, setVentasAsociadas] = useState<AssociatedSale[] | null>(null);
  /** Error del borrado simple (red, 5xx). Se muestra en la modal de confirmación. */
  const [error, setError] = useState<string | null>(null);
  /** Error del borrado en cascada. Se muestra en la modal de cascada. */
  const [errorCascada, setErrorCascada] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      if (target.tipo === 'compra') {
        await deleteBuy.mutateAsync(target.id);
      } else {
        await deleteSold.mutateAsync(target.id);
      }
      onClose();
    } catch (err) {
      // 409 con ventas asociadas → la modal de cascada ES la confirmación:
      // no se muestra el error del server, se pasa al paso 2.
      // Si el 409 NO trae `associated_sales` (S11), el guard devuelve false
      // y el mensaje del server se muestra en la modal de confirmación.
      if (target.tipo === 'compra' && isDeleteBuy409(err)) {
        setVentasAsociadas(err.body.associated_sales);
        setEnCascada(true);
        return;
      }
      setError(mensajeDeError(err, 'Error al eliminar'));
    }
  };

  const handleCascadeConfirm = async () => {
    if (target.tipo !== 'compra') return;
    setErrorCascada(null);
    try {
      await deleteBuyCascade.mutateAsync(target.id);
      onClose();
    } catch (err) {
      setErrorCascada(mensajeDeError(err, 'Error al eliminar en cascada'));
    }
  };

  const handleClose = () => {
    setError(null);
    setErrorCascada(null);
    onClose();
  };

  const handleCascadeClose = () => {
    if (deleteBuyCascade.isPending) return; // No cerrar mientras está en curso.
    setErrorCascada(null);
    onClose();
  };

  // Paso 2: doble confirmación del borrado en cascada.
  if (enCascada && ventasAsociadas && target.tipo === 'compra') {
    return (
      <DeleteBuyModal
        productName={target.nombre}
        sales={ventasAsociadas}
        isPending={deleteBuyCascade.isPending}
        cascadeError={errorCascada}
        onClose={handleCascadeClose}
        onConfirm={handleCascadeConfirm}
      />
    );
  }

  // Paso 1: confirmación simple.
  return (
    <ConfirmDeleteModal
      title={target.tipo === 'compra' ? 'Eliminar compra' : 'Eliminar venta'}
      description={
        target.tipo === 'compra' ? (
          <>
            ¿Eliminar <strong>"{target.nombre}"</strong>? No se puede deshacer.
          </>
        ) : (
          <>¿Eliminar esta venta? No se puede deshacer.</>
        )
      }
      error={error}
      isPending={target.tipo === 'compra' ? deleteBuy.isPending : deleteSold.isPending}
      confirmLabel="Sí, eliminar"
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}
