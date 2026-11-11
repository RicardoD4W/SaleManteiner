import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { ErrorState } from '../ui/ErrorState';
import { PencilIcon, TrashIcon } from '../ui/icons';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import { formatEuro } from '../../lib/format';
import { ApiError, apiErrorMessage } from '../../api/client';
import type { ApiAssociatedExpense } from '../../api/expenses';
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '../../hooks/useExpenseCategories';
import { useAnimatedClose } from '../../hooks/useExitAnimation';
import { useAnimatedRows } from '../../hooks/useAnimatedRows';
import type { ExpenseCategory } from '../../schemas/expenses';

export interface ExpenseCategoryCascadeRequest {
  category: ExpenseCategory;
  expenses: ApiAssociatedExpense[];
}

interface CategoryManagerModalProps {
  onClose: () => void;
  onCascadeRequired: (request: ExpenseCategoryCascadeRequest) => void;
}

type CascadeConflict = ApiError & {
  body: { error: string; associated_expenses: ApiAssociatedExpense[] };
};

function isCascadeConflict(err: unknown): err is CascadeConflict {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as { associated_expenses?: ApiAssociatedExpense[] };
  return Array.isArray(body.associated_expenses) && body.associated_expenses.length > 0;
}

export function CategoryManagerModal({ onClose, onCascadeRequired }: CategoryManagerModalProps) {
  const { data: categories, isLoading, isError, error, refetch } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { closing, close } = useAnimatedClose(onClose);

  const { rows: categoryRows, rowClassName, rowKey } = useAnimatedRows(categories ?? []);

  const deleteClose = useAnimatedClose(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  });

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError('El nombre de la categoría es obligatorio');
      return;
    }
    setCreateError(null);
    try {
      await createCategory.mutateAsync({ name });
      setNewName('');
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'No se pudo crear la categoría'));
    }
  };

  const handleStartRename = (category: ExpenseCategory) => {
    setRenamingId(category.id);
    setRenameValue(category.name);
    setRenameError(null);
  };

  const handleRename = async (id: number) => {
    const name = renameValue.trim();
    if (!name) {
      setRenameError('El nombre de la categoría es obligatorio');
      return;
    }
    setRenameError(null);
    try {
      await updateCategory.mutateAsync({ id, input: { name } });
      setRenamingId(null);
    } catch (err) {
      setRenameError(apiErrorMessage(err, 'No se pudo renombrar la categoría'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      deleteClose.close();
    } catch (err) {
      if (isCascadeConflict(err)) {
        onCascadeRequired({ category: deleteTarget, expenses: err.body.associated_expenses });
        return;
      }
      setDeleteError(apiErrorMessage(err, 'No se pudo eliminar la categoría'));
    }
  };

  return (
    <Modal title="Categorías de gasto" onClose={close} exiting={closing} size="medium">
      <div className="space-y-4 p-4">
        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Spinner size="sm" /> Cargando categorías…
          </div>
        ) : null}

        {isError ? (
          <div className={cn(errorAlertClass, 'p-4')}>
            <ErrorState
              message={`No se pudieron cargar las categorías: ${error.message}`}
              onRetry={() => refetch()}
              messageClassName=""
            />
          </div>
        ) : null}

        {!isLoading && !isError && categoryRows.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No hay categorías todavía. Crea la primera para poder registrar gastos.
          </p>
        ) : null}

        {categoryRows.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {categoryRows.map((category) => (
              <li
                key={rowKey(category.id)}
                className={cn('flex flex-wrap items-center gap-3 py-3', rowClassName(category.id))}
              >
                {renamingId === category.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      label={`Nuevo nombre de ${category.name}`}
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        isLoading={updateCategory.isPending}
                        onClick={() => handleRename(category.id)}
                      >
                        Guardar nombre
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRenamingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                    {renameError ? (
                      <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
                        {renameError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {category.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {category.expenses_count === 1
                        ? '1 gasto'
                        : `${category.expenses_count} gastos`}
                    </span>
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {formatEuro(category.total)}
                    </span>
                    <div className="ml-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartRename(category)}
                        aria-label={`Renombrar ${category.name}`}
                        className="cursor-pointer rounded text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteClose.cancel();
                          setDeleteTarget(category);
                          setDeleteError(null);
                        }}
                        aria-label={`Borrar ${category.name}`}
                        className="cursor-pointer rounded text-red-700 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {deleteTarget ? (
          <div
            className={cn(
              'space-y-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30',
              deleteClose.closing ? 'animate-pop-out' : 'animate-pop-in',
            )}
          >
            <p className="text-sm text-gray-800 dark:text-gray-100">
              ¿Eliminar la categoría <strong>"{deleteTarget.name}"</strong>? No se puede deshacer.
            </p>
            {deleteError ? (
              <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
                {deleteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  deleteClose.close();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deleteCategory.isPending}
                onClick={handleDelete}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <Input
            label="Nueva categoría"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Alquiler, suministros…"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={createCategory.isPending}
              onClick={handleCreate}
            >
              Crear categoría
            </Button>
          </div>
          {createError ? (
            <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
              {createError}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
