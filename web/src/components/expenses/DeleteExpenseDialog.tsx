import { useState } from 'react';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { useDeleteExpense } from '../../hooks/useExpenses';
import { apiErrorMessage } from '../../api/client';
import type { Expense } from '../../schemas/expenses';

interface DeleteExpenseDialogProps {
  expense: Expense;

  onClose: () => void;
}

export function DeleteExpenseDialog({ expense, onClose }: DeleteExpenseDialogProps) {
  const deleteExpense = useDeleteExpense();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await deleteExpense.mutateAsync(expense.id);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al eliminar el gasto'));
    }
  };

  return (
    <ConfirmDeleteModal
      title="Eliminar gasto"
      description={
        <>
          ¿Eliminar <strong>"{expense.concept}"</strong>? No se puede deshacer.
        </>
      }
      error={error}
      isPending={deleteExpense.isPending}
      confirmLabel="Sí, eliminar"
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
}
