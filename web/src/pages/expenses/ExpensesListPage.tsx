import { useMemo, useState } from 'react';
import { useExpenses } from '../../hooks/useExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { useSortable } from '../../hooks/useSortable';
import { useAnimatedRows } from '../../hooks/useAnimatedRows';
import { Spinner } from '../../components/ui/Spinner';
import { tableHeadClass } from '../../components/ui/tableStyles';
import { SortableTableHead } from '../../components/ui/SortableTableHead';
import { ErrorState } from '../../components/ui/ErrorState';
import { ExpenseFormModal } from '../../components/expenses/ExpenseFormModal';
import {
  CategoryManagerModal,
  type ExpenseCategoryCascadeRequest,
} from '../../components/expenses/CategoryManagerModal';
import { DeleteExpenseDialog } from '../../components/expenses/DeleteExpenseDialog';
import { DeleteExpenseCategoryCascadeModal } from '../../components/expenses/DeleteExpenseCategoryCascadeModal';
import { useDeleteExpenseCategoryCascade } from '../../hooks/useExpenseCategories';
import { apiErrorMessage } from '../../api/client';
import { formatDate, formatEuro } from '../../lib/format';
import { round2 } from '../../lib/round';
import type { Expense } from '../../schemas/expenses';
import { cn } from '../../lib/classNames';
import { PencilIcon, TrashIcon } from '../../components/ui/icons';

interface ExpenseRow {
  id: number;
  concept: string;
  category: string;
  amount: number;
  expense_date: string;
  expense: Expense;
}

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
  const [categoryCascade, setCategoryCascade] = useState<ExpenseCategoryCascadeRequest | null>(
    null,
  );
  const [categoryCascadeError, setCategoryCascadeError] = useState<string | null>(null);
  const deleteCategoryCascade = useDeleteExpenseCategoryCascade();

  const categoryNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const category of categories ?? []) {
      names.set(category.id, category.name);
    }
    return names;
  }, [categories]);

  const rows = useMemo<ExpenseRow[]>(
    () =>
      (expenses ?? []).map((expense) => ({
        id: expense.id,
        concept: expense.concept,
        category: categoryNames.get(expense.category_id) ?? '',
        amount: expense.amount,
        expense_date: expense.expense_date,
        expense,
      })),
    [expenses, categoryNames],
  );

  const { sortedItems, sortKey, sortDir, onSort } = useSortable<ExpenseRow>(rows);

  const {
    rows: animatedRows,
    rowClassName,
    rowKey,
  } = useAnimatedRows(sortedItems, categoryId === null ? '' : String(categoryId), 'slide');

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

      {animatedRows.length === 0 ? (
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
                <SortableTableHead<ExpenseRow>
                  label="Concepto"
                  sortKey="concept"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <SortableTableHead<ExpenseRow>
                  label="Categoría"
                  sortKey="category"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <SortableTableHead<ExpenseRow>
                  label="Importe"
                  sortKey="amount"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <SortableTableHead<ExpenseRow>
                  label="Fecha"
                  sortKey="expense_date"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={onSort}
                />
                <th scope="col" className={`${tableHeadClass} text-left`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {animatedRows.map((row) => (
                <tr
                  key={rowKey(row.id)}
                  className={cn('hover:bg-gray-50 dark:hover:bg-gray-800', rowClassName(row.id))}
                >
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {row.concept}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {row.category || '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatEuro(row.amount)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {formatDate(row.expense_date)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(row.expense)}
                        aria-label={`Editar ${row.concept}`}
                        className="cursor-pointer rounded text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(row.expense)}
                        aria-label={`Borrar ${row.concept}`}
                        className="cursor-pointer rounded text-red-700 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <TrashIcon />
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
        <CategoryManagerModal
          onClose={() => setIsManagingCategories(false)}
          onCascadeRequired={(request) => {
            setIsManagingCategories(false);
            setCategoryCascadeError(null);
            setCategoryCascade(request);
          }}
        />
      ) : null}
      {categoryCascade ? (
        <DeleteExpenseCategoryCascadeModal
          categoryName={categoryCascade.category.name}
          expenses={categoryCascade.expenses}
          isPending={deleteCategoryCascade.isPending}
          cascadeError={categoryCascadeError}
          onClose={() => {
            if (deleteCategoryCascade.isPending) return;
            setCategoryCascade(null);
            setCategoryCascadeError(null);
          }}
          onConfirm={async () => {
            setCategoryCascadeError(null);
            try {
              await deleteCategoryCascade.mutateAsync(categoryCascade.category.id);
              setCategoryCascade(null);
            } catch (err) {
              setCategoryCascadeError(
                apiErrorMessage(err, 'No se pudo eliminar la categoría ni sus gastos'),
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}
