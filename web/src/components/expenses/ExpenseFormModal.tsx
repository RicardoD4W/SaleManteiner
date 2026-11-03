import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExpenseFormSchema,
  type Expense,
  type ExpenseCategory,
  type ExpenseFormInput,
  type ExpenseFormOutput,
} from '../../schemas/expenses';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useCreateExpense, useUpdateExpense } from '../../hooks/useExpenses';
import { useCreateExpenseCategory, useExpenseCategories } from '../../hooks/useExpenseCategories';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import { todayLocalDate } from '../../lib/format';

type ExpenseFormModalProps =
  { mode: 'create'; onClose: () => void } | { mode: 'edit'; expense: Expense; onClose: () => void };

const selectClass =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export function ExpenseFormModal(props: ExpenseFormModalProps) {
  const { onClose } = props;
  const { data: categories } = useExpenseCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createCategory = useCreateExpenseCategory();

  const fieldId = useId();
  const conceptInputId = `${fieldId}-concept`;
  const amountInputId = `${fieldId}-amount`;
  const dateInputId = `${fieldId}-date`;
  const categorySelectId = `${fieldId}-category`;
  const conceptErrorId = `${fieldId}-concept-error`;
  const amountErrorId = `${fieldId}-amount-error`;
  const dateErrorId = `${fieldId}-date-error`;
  const categoryErrorId = `${fieldId}-category-error`;

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<ExpenseCategory | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: {
      concept: props.mode === 'edit' ? props.expense.concept : '',
      amount: props.mode === 'edit' ? props.expense.amount : undefined,
      expense_date: props.mode === 'edit' ? props.expense.expense_date : todayLocalDate(),
      category_id: props.mode === 'edit' ? props.expense.category_id : undefined,
    },
  });

  const categoryOptions = useMemo<ExpenseCategory[]>(() => {
    const list = categories ?? [];
    if (pendingCategory && !list.some((category) => category.id === pendingCategory.id)) {
      return [...list, pendingCategory];
    }
    return list;
  }, [categories, pendingCategory]);

  const hasCategories = categoryOptions.length > 0;
  const showCategoryForm = !hasCategories || isCreatingCategory;

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError('El nombre de la categoría es obligatorio');
      return;
    }
    setCategoryError(null);
    try {
      const created = await createCategory.mutateAsync({ name });
      setPendingCategory(created);
      setValue('category_id', created.id, { shouldValidate: true });
      setNewCategoryName('');
      setIsCreatingCategory(false);
    } catch (err) {
      setCategoryError(apiErrorMessage(err, 'No se pudo crear la categoría'));
    }
  };

  const onSubmit = async (values: ExpenseFormOutput) => {
    try {
      if (props.mode === 'create') {
        await createExpense.mutateAsync({
          concept: values.concept.trim(),
          amount: values.amount,
          category_id: values.category_id,
          expense_date: values.expense_date,
        });
      } else {
        await updateExpense.mutateAsync({
          id: props.expense.id,
          input: {
            concept: values.concept.trim(),
            amount: values.amount,
            category_id: values.category_id,
            expense_date: values.expense_date,
          },
        });
      }
      onClose();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Error desconocido') });
    }
  };

  const title = props.mode === 'create' ? 'Nuevo gasto' : 'Editar gasto';

  return (
    <Modal title={title} onClose={onClose} initialFocusSelector="input">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-4">
        <div>
          <Input
            {...register('concept')}
            id={conceptInputId}
            label="Concepto *"
            placeholder="Alquiler del local…"
            aria-invalid={errors.concept ? true : undefined}
            aria-describedby={errors.concept ? conceptErrorId : undefined}
          />
          {errors.concept ? (
            <p id={conceptErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
              {errors.concept.message}
            </p>
          ) : null}
        </div>

        <div>
          <Input
            {...register('amount', { valueAsNumber: true })}
            id={amountInputId}
            type="number"
            step="0.01"
            min="0"
            label="Importe (€) *"
            placeholder="0.00"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? amountErrorId : undefined}
          />
          {errors.amount ? (
            <p id={amountErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
              {errors.amount.message}
            </p>
          ) : null}
        </div>

        <div>
          <Input
            {...register('expense_date')}
            id={dateInputId}
            type="date"
            label="Fecha *"
            aria-invalid={errors.expense_date ? true : undefined}
            aria-describedby={errors.expense_date ? dateErrorId : undefined}
          />
          {errors.expense_date ? (
            <p id={dateErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
              {errors.expense_date.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor={categorySelectId}
            className="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            Categoría *
          </label>
          <select
            {...register('category_id', { valueAsNumber: true })}
            id={categorySelectId}
            className={cn(selectClass)}
            aria-invalid={errors.category_id ? true : undefined}
            aria-describedby={errors.category_id ? categoryErrorId : undefined}
          >
            <option value="">Selecciona una categoría</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.category_id ? (
            <p id={categoryErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
              {errors.category_id.message}
            </p>
          ) : null}

          {!hasCategories ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No hay categorías todavía. Crea la primera para registrar el gasto.
            </p>
          ) : null}

          {showCategoryForm ? (
            <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <Input
                label="Nombre de la nueva categoría"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Alquiler, suministros…"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={createCategory.isPending}
                  onClick={handleCreateCategory}
                >
                  Crear y usar
                </Button>
                {hasCategories ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatingCategory(false)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingCategory(true)}
            >
              + Nueva categoría
            </Button>
          )}

          {categoryError ? (
            <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
              {categoryError}
            </p>
          ) : null}
        </div>

        {errors.root ? (
          <p className={cn(errorAlertClass, 'px-3 py-2')} role="alert">
            {errors.root.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting || createExpense.isPending || updateExpense.isPending}
          >
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
