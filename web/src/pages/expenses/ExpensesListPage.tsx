import { useMemo, useState } from 'react';
import { useExpenses } from '../../hooks/useExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { Spinner } from '../../components/ui/Spinner';
import { tableHeadClass } from '../../components/ui/tableStyles';
import { ErrorState } from '../../components/ui/ErrorState';
import { ExpenseFormModal } from '../../components/expenses/ExpenseFormModal';
import { CategoryManagerModal } from '../../components/expenses/CategoryManagerModal';
import { DeleteExpenseDialog } from '../../components/expenses/DeleteExpenseDialog';
import { formatDate, formatEuro } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { Expense } from '../../schemas/expenses';
import { cn } from '../../lib/classNames';

export function ExpensesListPage() {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const {
    data: expenses,
    isLoading,
    isError,
    error,
    refetch,
  } = useExpenses(categoryId ?? undefined);
  const { data: categories } = useExpenseCategories();

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [isManagingCategories, setIsManagingCategories] = useState(false);

  const categoryNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const category of categories ?? []) {
      names.set(category.id, category.name);
    }
    return names;
  }, [categories]);

  const rows = useMemo<Expense[]>(() => expenses ?? [], [expenses]);

  const total = useMemo(
    () => round2(rows.reduce((acc, expense) => acc + expense.amount, 0)),
    [rows],
  );

  const closeModals = () => {
    setIsCreating(false);
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando gastos…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn('rounded-md border border-red-200 p-4', 'dark:border-red-800')}>
        <ErrorState
          message={`No se pudieron cargar los gastos: ${error.message}`}
          onRetry={() => refetch()}
          messageClassName=""
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Gastos</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManagingCategories(true)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
          >
            Gestionar categorías
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:bg-brand-400 dark:focus-visible:ring-offset-gray-900"
          >
            + Nuevo gasto
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="expenses-category-filter"
          className="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          Categoría
        </label>
        <select
          id="expenses-category-filter"
          value={categoryId === null ? '' : String(categoryId)}
          onChange={(event) =>
            setCategoryId(event.target.value === '' ? null : Number(event.target.value))
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Todas</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {categoryId === null ? 'No hay gastos todavía.' : 'No hay gastos en esta categoría.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th scope="col" className={`${tableHeadClass} text-left`}>
                  Concepto
                </th>
                <th scope="col" className={`${tableHeadClass} text-left`}>
                  Categoría
                </th>
                <th scope="col" className={`${tableHeadClass} text-right`}>
                  Importe
                </th>
                <th scope="col" className={`${tableHeadClass} text-left`}>
                  Fecha
                </th>
                <th scope="col" className={`${tableHeadClass} text-left`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {expense.concept}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {categoryNames.get(expense.category_id) ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatEuro(expense.amount)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {formatDate(expense.expense_date)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(expense)}
                        aria-label={`Editar ${expense.concept}`}
                        className="cursor-pointer text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-offset-gray-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(expense)}
                        aria-label={`Borrar ${expense.concept}`}
                        className="cursor-pointer text-sm font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:focus-visible:ring-offset-gray-900"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
            <span className="text-gray-600 dark:text-gray-400">
              {rows.length === 1 ? '1 gasto' : `${rows.length} gastos`}
            </span>
            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
              Total: {formatEuro(total)}
            </span>
          </div>
        </div>
      )}

      {isCreating ? <ExpenseFormModal mode="create" onClose={closeModals} /> : null}
      {editing ? <ExpenseFormModal mode="edit" expense={editing} onClose={closeModals} /> : null}
      {deleting ? (
        <DeleteExpenseDialog expense={deleting} onClose={() => setDeleting(null)} />
      ) : null}
      {isManagingCategories ? (
        <CategoryManagerModal onClose={() => setIsManagingCategories(false)} />
      ) : null}
    </div>
  );
}
