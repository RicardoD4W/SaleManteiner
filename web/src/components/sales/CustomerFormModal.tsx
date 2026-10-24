import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCustomerInput, UpdateCustomerInput } from '../../schemas/customers';
import type { Customer } from '../../schemas/customers';
import {
  CustomerFormSchema,
  type CustomerFormInput,
  type CustomerFormOutput,
} from '../../schemas/forms';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useFocusTrap } from '../ui/useFocusTrap';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { useUpdateCustomer } from '../../hooks/useUpdateCustomer';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';

type CustomerFormModalProps =
  | { mode: 'create'; onClose: () => void }
  | { mode: 'edit'; customer: Customer; onClose: () => void };

export function CustomerFormModal(props: CustomerFormModalProps) {
  const { onClose } = props;
  const create = useCreateCustomer();
  const update = useUpdateCustomer();

  const dialogRef = useRef<HTMLDivElement>(null);

  const titleId = useId();
  const nameInputId = `${titleId}-name`;
  const nameErrorId = `${titleId}-name-error`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: {
      name: props.mode === 'edit' ? props.customer.name : '',
    },
  });

  useFocusTrap({
    dialogRef,
    onEscape: onClose,
    initialFocusSelector: 'input',
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onSubmit = async (values: CustomerFormOutput) => {
    const name = values.name.trim();
    try {
      if (props.mode === 'create') {
        await create.mutateAsync({ name } satisfies CreateCustomerInput);
      } else {
        await update.mutateAsync({
          id: props.customer.id,
          input: { name } satisfies UpdateCustomerInput,
        });
      }
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, 'Error desconocido');
      setError('root', { message });
    }
  };

  const title = props.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:text-gray-300"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-4">
          <Input
            {...register('name')}
            id={nameInputId}
            label="Nombre *"
            placeholder="Nombre del cliente…"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
          />

          {errors.name ? (
            <p id={nameErrorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
              {errors.name.message}
            </p>
          ) : null}

          {errors.root ? (
            <p className={cn(errorAlertClass, 'px-3 py-2')} role="alert">
              {errors.root.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting || create.isPending || update.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
