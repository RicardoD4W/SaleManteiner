import { DeleteCascadeModal } from '../sales/DeleteCascadeModal';
import { formatDate, formatEuro } from '../../lib/format';
import type { ApiAssociatedExpense } from '../../api/expenses';

interface DeleteExpenseCategoryCascadeModalProps {
  categoryName: string;
  expenses: ApiAssociatedExpense[];
  isPending: boolean;
  cascadeError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteExpenseCategoryCascadeModal({
  categoryName,
  expenses,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteExpenseCategoryCascadeModalProps) {
  const items = expenses.map((expense) => ({
    id: expense.id,
    title: `Gasto #${expense.id}`,
    description: `${expense.concept} · ${formatDate(expense.expense_date)}`,
    badge: formatEuro(expense.amount),
  }));

  return (
    <DeleteCascadeModal
      title="La categoría tiene gastos asociados"
      entityName={categoryName}
      entityPhrase="La categoría"
      entityPronoun="la"
      confirmLabel="Borrar también los gastos y la categoría"
      countLabelSingular="gasto registrado"
      countLabelPlural="gastos registrados"
      itemsNoun="los gastos"
      items={items}
      isPending={isPending}
      cascadeError={cascadeError}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
