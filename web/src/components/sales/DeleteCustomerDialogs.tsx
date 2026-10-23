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

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.body.error;
  if (err instanceof Error) return err.message;
  return fallback;
}

export interface DeleteCustomerDialogsProps {
  customer: Customer | null;

  onClose: () => void;
}

export function DeleteCustomerDialogs({ customer, onClose }: DeleteCustomerDialogsProps) {
  const deleteCustomer = useDeleteCustomer();
  const deleteCustomerCascade = useDeleteCustomerCascade();

  const [inCascade, setInCascade] = useState(false);

  const [associatedSales, setAssociatedSales] = useState<AssociatedCustomerSale[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [cascadeError, setCascadeError] = useState<string | null>(null);

  const close = () => {
    setInCascade(false);
    setAssociatedSales(null);
    setError(null);
    setCascadeError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!customer) return;
    setError(null);
    try {
      await deleteCustomer.mutateAsync(customer.id);
      close();
    } catch (err) {
      if (isDeleteCustomer409(err)) {
        setAssociatedSales(err.body.associated_sales);
        setInCascade(true);
        return;
      }
      setError(errorMessage(err, 'Error al eliminar'));
    }
  };

  const handleCascadeConfirm = async () => {
    if (!customer) return;
    setCascadeError(null);
    try {
      await deleteCustomerCascade.mutateAsync(customer.id);
      close();
    } catch (err) {
      setCascadeError(errorMessage(err, 'Error al eliminar en cascada'));
    }
  };

  const handleCascadeClose = () => {
    if (deleteCustomerCascade.isPending) return;
    close();
  };

  if (!customer) return null;

  if (inCascade && associatedSales) {
    return (
      <DeleteCustomerModal
        customerName={customer.name}
        sales={associatedSales}
        isPending={deleteCustomerCascade.isPending}
        cascadeError={cascadeError}
        onClose={handleCascadeClose}
        onConfirm={handleCascadeConfirm}
      />
    );
  }

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
