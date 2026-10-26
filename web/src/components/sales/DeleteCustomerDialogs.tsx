import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DeleteCustomerModal } from './DeleteCustomerModal';
import { useDeleteCustomer, useDeleteCustomerCascade } from '../../hooks/useDeleteCustomer';
import { useCascadeDeleteFlow } from '../../hooks/useCascadeDeleteFlow';
import type { Customer } from '../../schemas/customers';

interface DeleteCustomerDialogsProps {
  customer: Customer | null;

  onClose: () => void;
}

export function DeleteCustomerDialogs({ customer, onClose }: DeleteCustomerDialogsProps) {
  const deleteCustomer = useDeleteCustomer();
  const deleteCustomerCascade = useDeleteCustomerCascade();

  const flow = useCascadeDeleteFlow({
    id: customer?.id ?? null,
    resetKey: customer?.id ?? null,
    deleteOne: deleteCustomer,
    deleteCascade: deleteCustomerCascade,
    onClose,
  });

  if (!customer) return null;

  if (flow.inCascade && flow.associatedSales) {
    return (
      <DeleteCustomerModal
        customerName={customer.name}
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
      title="Eliminar cliente"
      description={
        <>
          ¿Eliminar <strong>"{customer.name}"</strong>? No se puede deshacer.
        </>
      }
      error={flow.error}
      isPending={deleteCustomer.isPending}
      confirmLabel="Sí, eliminar"
      onClose={flow.close}
      onConfirm={flow.confirm}
    />
  );
}
