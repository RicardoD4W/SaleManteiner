/**
 * Modal de alta/edición de cliente (S1 y S2 del feature clientes-crud).
 *
 * Un único campo: el nombre. La validación usa los schemas Zod que YA
 * existen en `schemas/customers.ts` (`CreateCustomerInput` para el alta y
 * `UpdateCustomerInput` para la edición); los mensajes de error se traducen
 * al español en el resolver.
 *
 * El alta usa `useCreateCustomer` (ya existente) y la edición
 * `useUpdateCustomer`.
 *
 * Accesibilidad (WCAG 2.2):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` en el header.
 *  - Focus trap: Tab / Shift+Tab ciclan dentro del diálogo.
 *  - Cierre con Escape o click en el backdrop.
 *  - El foco va al campo de nombre al abrir y vuelve al elemento que abrió
 *    el modal al cerrar.
 *  - Los errores (de campo y del servidor) se anuncian con `role="alert"`.
 */
import { useEffect, useId, useRef } from 'react';
import { useForm, type FieldErrors, type Resolver, type ResolverResult } from 'react-hook-form';
import { z } from 'zod';
import { CreateCustomerInput, UpdateCustomerInput } from '../../schemas/customers';
import type { Customer } from '../../schemas/customers';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { useUpdateCustomer } from '../../hooks/useUpdateCustomer';
import { ApiError } from '../../api/client';

/** Valores del form: los del schema de alta (el nombre es obligatorio). */
type CustomerFormValues = z.infer<typeof CreateCustomerInput>;

/** Schemas Zod existentes que se usan para validar el nombre. */
type CustomerNameSchema = typeof CreateCustomerInput | typeof UpdateCustomerInput;

/**
 * Props del modal: alta o edición (unión discriminada por `mode`).
 *  - `mode: 'create'` → alta de un cliente nuevo.
 *  - `mode: 'edit'`   → edición del cliente recibido.
 */
export type CustomerFormModalProps =
  | { mode: 'create'; onClose: () => void }
  | { mode: 'edit'; customer: Customer; onClose: () => void };

/** Traduce un issue de Zod a un mensaje en español. */
function nombreErrorMessage(issue: { code: string }): string {
  if (issue.code === 'too_small') return 'El nombre es obligatorio';
  if (issue.code === 'too_big') return 'Máximo 200 caracteres';
  return 'Nombre inválido';
}

/**
 * Resolver de react-hook-form que valida con el schema Zod existente
 * (sin inventar otro schema). El nombre se valida ya recortado: un nombre
 * de solo espacios es un nombre vacío.
 */
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
        errors.name = { type: 'validation', message: nombreErrorMessage(issue) };
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

  // Elemento que tenía el foco antes de abrir el modal: al cerrar, el foco
  // vuelve ahí (el botón "Nuevo cliente" o el "Editar" de la fila).
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      previous?.focus();
    };
  }, []);

  // Foco al primer input al montar (el modal se monta fresh en cada apertura).
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  // Escape para cerrar.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click en el backdrop cierra.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Focus trap: Tab / Shift+Tab ciclan dentro del diálogo.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onSubmit = async (values: CustomerFormValues) => {
    const name = values.name.trim();
    try {
      if (props.mode === 'create') {
        await create.mutateAsync({ name });
      } else {
        await update.mutateAsync({ id: props.customer.id, input: { name } });
      }
      // Los hooks invalidan la caché de clientes al éxito. Cerramos el modal.
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.body.error
          : err instanceof Error
            ? err.message
            : 'Error desconocido';
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
        onKeyDown={handleKeyDown}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Header */}
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

        {/* Body (form) */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <Input
            id={nameInputId}
            label="Nombre *"
            placeholder="Nombre del cliente…"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
            {...register('name')}
          />

          {errors.name ? (
            <p id={nameErrorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          ) : null}

          {errors.root ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              role="alert"
            >
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
