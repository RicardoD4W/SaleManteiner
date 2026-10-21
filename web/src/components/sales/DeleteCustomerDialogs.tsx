/**
 * Flujo de borrado de un cliente desde la vista de Clientes (S3 del
 * feature `clientes-crud`).
 *
 * Es el equivalente de `DeleteDialogs` (el de compras y ventas): concentra
 * los dos pasos del borrado y se renderiza a NIVEL DE PÁGINA (no dentro de
 * la fila de la tabla).
 *
 * Paso 1: `ConfirmDeleteModal` (confirmación simple).
 *  - `DELETE /api/customers/:id`. Si el server responde 409 (el cliente
 *    tiene ventas asociadas) → paso 2.
 * Paso 2: `DeleteCustomerModal` (doble confirmación) →
 *  `DELETE /api/customers/:id/cascade`.
 *
 * Los hooks (`useDeleteCustomer`, `useDeleteCustomerCascade`) ya disparan el
 * toast e invalidan la caché.
 */
import { useState } from 'react';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DeleteCustomerModal } from './DeleteCustomerModal';
import {
  useDeleteCustomer,
  useDeleteCustomerCascade,
  isDeleteCustomer409,
  type AssociatedCustomerSale,
} from '../../hooks/useDeleteCustomer';
import { ApiError } from '../../api/client';
import type { Customer } from '../../schemas/customers';

/** Extrae el mensaje de un error de la API. */
function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.body.error;
  if (err instanceof Error) return err.message;
  return fallback;
}

export interface DeleteCustomerDialogsProps {
  /** Cliente a borrar (o `null` para no mostrar nada). */
  customer: Customer | null;
  /** Cierra el flujo (borrado hecho o cancelado). */
  onClose: () => void;
}

export function DeleteCustomerDialogs({ customer, onClose }: DeleteCustomerDialogsProps) {
  const deleteCustomer = useDeleteCustomer();
  const deleteCustomerCascade = useDeleteCustomerCascade();

  /** Paso 2 = el cliente tiene ventas asociadas y hay que confirmar la cascada. */
  const [enCascada, setEnCascada] = useState(false);
  /** Ventas asociadas del 409 (para listar en la modal de cascada). */
  const [ventasAsociadas, setVentasAsociadas] = useState<AssociatedCustomerSale[] | null>(null);
  /** Error del borrado simple (red, 5xx). Se muestra en la modal de confirmación. */
  const [error, setError] = useState<string | null>(null);
  /** Error del borrado en cascada. Se muestra en la modal de cascada. */
  const [errorCascada, setErrorCascada] = useState<string | null>(null);

  /** Cierra el flujo y limpia su estado. */
  const close = () => {
    setEnCascada(false);
    setVentasAsociadas(null);
    setError(null);
    setErrorCascada(null);
    onClose();
  };

  /** Paso 1: confirmación del borrado simple. */
  const handleConfirm = async () => {
    if (!customer) return;
    setError(null);
    try {
      await deleteCustomer.mutateAsync(customer.id);
      close();
    } catch (err) {
      // 409 con ventas asociadas → la modal de cascada ES la confirmación:
      // no se muestra el error del server, se pasa al paso 2.
      // Si el 409 NO trae `associated_sales` (guard estricto), el mensaje
      // del server se muestra en la modal de confirmación.
      if (isDeleteCustomer409(err)) {
        setVentasAsociadas(err.body.associated_sales);
        setEnCascada(true);
        return;
      }
      setError(mensajeDeError(err, 'Error al eliminar'));
    }
  };

  /** Paso 2: confirmación del borrado en cascada. */
  const handleCascadeConfirm = async () => {
    if (!customer) return;
    setErrorCascada(null);
    try {
      await deleteCustomerCascade.mutateAsync(customer.id);
      close();
    } catch (err) {
      setErrorCascada(mensajeDeError(err, 'Error al eliminar en cascada'));
    }
  };

  /** Cierre de la modal de cascada (Escape, backdrop o "Cancelar"). */
  const handleCascadeClose = () => {
    if (deleteCustomerCascade.isPending) return; // No cerrar mientras está en curso.
    close();
  };

  if (!customer) return null;

  // Paso 2: doble confirmación del borrado en cascada.
  if (enCascada && ventasAsociadas) {
    return (
      <DeleteCustomerModal
        customerName={customer.name}
        sales={ventasAsociadas}
        isPending={deleteCustomerCascade.isPending}
        cascadeError={errorCascada}
        onClose={handleCascadeClose}
        onConfirm={handleCascadeConfirm}
      />
    );
  }

  // Paso 1: confirmación simple.
  return (
    <ConfirmDeleteModal
      title="Eliminar cliente"
      description={
        <>
          ¿Eliminar <strong>"{customer.name}"</strong>? No se puede deshacer.
        </>
      }
      error={error}
      isPending={deleteCustomer.isPending}
      confirmLabel="Sí, eliminar"
      onClose={close}
      onConfirm={handleConfirm}
    />
  );
}
