import { useId, useRef } from 'react';
import { useForm, type FieldErrors, type Resolver, type ResolverResult } from 'react-hook-form';
import { z } from 'zod';
import { CreateCustomerInput, UpdateCustomerInput } from '../../schemas/customers';
import type { Customer } from '../../schemas/customers';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useFocusTrap } from '../ui/useFocusTrap';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { useUpdateCustomer } from '../../hooks/useUpdateCustomer';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';

type CustomerFormValues = z.infer<typeof CreateCustomerInput>;

type CustomerNameSchema = typeof CreateCustomerInput | typeof UpdateCustomerInput;

type CustomerFormModalProps =
  | { mode: 'create'; onClose: () => void }
  | { mode: 'edit'; customer: Customer; onClose: () => void };

function nameErrorMessage(issue: { code: string }): string {
  if (issue.code === 'too_small') return 'El nombre es obligatorio';
  if (issue.code === 'too_big') return 'Máximo 200 caracteres';
  return 'Nombre inválido';
}

function buildResolver(schema: CustomerNameSchema): Resolver<CustomerFormValues> {
  return async (values): Promise<ResolverResult<CustomerFormValues>> => {
    const result = schema.safeParse({ ...values, name: values.name.trim() });
    if (result.success) {
      const name = result.data.name;
      if (typeof name !== 'string') {
        const errors: FieldErrors<CustomerFormValues> = {
          name: { type: 'validation', message: 'El nombre es obligatorio' },
        };
        return { values: {}, errors };
      }
      return { values: { name }, errors: {} };
    }

    const errors: FieldErrors<CustomerFormValues> = {};
    for (const issue of result.error.issues) {
      if (issue.path[0] === 'name' && !errors.name) {
        errors.name = { type: 'validation', message: nameErrorMessage(issue) };
      }
    }
    return { values: {}, errors };
  };
}

export function CustomerFormModal(props: CustomerFormModalProps) {
  const { onClose } = props;
  const create = useCreateCustomer();
  const update = useUpdateCustomer();

  const dialogRef = useRef<HTMLDivElement>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameInputId = `${titleId}-name`;
  const nameErrorId = `${titleId}-name-error`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CustomerFormValues>({
    resolver: buildResolver(props.mode === 'create' ? CreateCustomerInput : UpdateCustomerInput),
    defaultValues: {
      name: props.mode === 'edit' ? props.customer.name : '',
    },
  });

  const { ref: registerNameRef, ...nameFieldProps } = register('name');

  useFocusTrap({
    dialogRef,
    onEscape: onClose,
    initialFocusRef: nameInputRef,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onSubmit = async (values: CustomerFormValues) => {
    const name = values.name.trim();
    try {
      if (props.mode === 'create') {
        await create.mutateAsync({ name });
      } else {
        await update.mutateAsync({ id: props.customer.id, input: { name } });
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
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <Input
            {...nameFieldProps}
            id={nameInputId}
            ref={(element) => {
              registerNameRef(element);
              nameInputRef.current = element;
            }}
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
