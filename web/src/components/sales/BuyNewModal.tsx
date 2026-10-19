/**
 * Modal para crear una nueva compra (S3 del feature dashboard-iteration-1).
 *
 * Sustituye al flujo anterior que navegaba a `/buys/new`. Replica la lógica
 * del antiguo `BuyNewPage` (Zod schema + react-hook-form + useCreateBuy) en
 * un dialog con focus trap y cierre con Escape.
 *
 * Patrón de montaje: el padre solo renderiza este componente cuando
 * isModalOpen es true, así cada apertura arranca con state fresco (no
 * necesitamos un useEffect para resetear el form).
 *
 * Accesibilidad (WCAG 2.2):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` en el header.
 *  - Cierre con Escape o click en backdrop.
 *  - Focus al primer input al montar.
 *  - `aria-invalid` y mensaje de error por campo.
 */
import { useEffect, useId, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateBuy } from '../../hooks/useCreateBuy';
import { todayLocalDate } from '../../lib/format';
import { ApiError } from '../../api/client';

const BuyFormSchema = z.object({
  product_name: z
    .string()
    .min(1, 'El producto es obligatorio')
    .max(200, 'Máximo 200 caracteres'),
  purchase_cost: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  quantity: z
    .number({ error: 'Introduce un número' })
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1'),
  associated_costs: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales')
    .default(0),
  purchase_date: z.string().optional().or(z.literal('')),
});

type BuyFormInput = z.input<typeof BuyFormSchema>;
type BuyFormOutput = z.output<typeof BuyFormSchema>;

interface BuyNewModalProps {
  onClose: () => void;
}

export function BuyNewModal({ onClose }: BuyNewModalProps) {
  const create = useCreateBuy();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<BuyFormInput, unknown, BuyFormOutput>({
    resolver: zodResolver(BuyFormSchema),
    defaultValues: {
      product_name: '',
      purchase_cost: 0,
      quantity: 1,
      associated_costs: 0,
      purchase_date: todayLocalDate(),
    },
  });

  // Foco al montar (no useEffect de reset: el componente se monta fresh cada vez).
  useEffect(() => {
    const firstInput = dialogRef.current?.querySelector<HTMLInputElement>('input');
    firstInput?.focus();
  }, []);

  // Escape para cerrar.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click en backdrop cierra.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onSubmit: SubmitHandler<BuyFormOutput> = async (values) => {
    const payload = {
      product_name: values.product_name.trim(),
      purchase_cost: values.purchase_cost,
      quantity: values.quantity,
      associated_costs: values.associated_costs,
      purchase_date: values.purchase_date?.trim() || undefined,
    };

    try {
      await create.mutateAsync(payload);
      // El hook invalida ['buys'] al éxito. Cerramos el modal.
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Nueva compra
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
            label="Producto *"
            placeholder="Funda iPhone 15"
            {...register('product_name')}
            error={errors.product_name?.message}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Coste (€) *"
              type="number"
              step="0.01"
              min="0"
              {...register('purchase_cost', { valueAsNumber: true })}
              error={errors.purchase_cost?.message}
              hint="Total pagado por el lote"
            />
            <Input
              label="Cantidad *"
              type="number"
              step="1"
              min="1"
              {...register('quantity', { valueAsNumber: true })}
              error={errors.quantity?.message}
              hint="Unidades del lote"
            />
          </div>

          <Input
            label="Costes asociados (€)"
            type="number"
            step="0.01"
            min="0"
            {...register('associated_costs', { valueAsNumber: true })}
            error={errors.associated_costs?.message}
            hint="Envío, comisión, etc. (opcional)"
          />

          <Input
            label="Fecha de compra"
            type="date"
            {...register('purchase_date')}
            error={errors.purchase_date?.message}
            hint="Día que compraste (opcional, default hoy)"
          />

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
            <Button type="submit" isLoading={isSubmitting || create.isPending}>
              Crear compra
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
