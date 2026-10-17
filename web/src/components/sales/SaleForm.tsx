import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCreateSale } from '../../hooks/useCreateSale';
import { useUpdateSale } from '../../hooks/useUpdateSale';
import {
  centsToEuros,
  eurosToCents,
  isoToLocalDate,
  localDateToISO,
  todayLocalDate,
} from '../../lib/format';
import { ApiError } from '../../api/client';
import type { Cents } from '../../schemas/common';
import type { Sale } from '../../schemas/sales';

/**
 * Schema del form (en euros y días). Se valida primero y luego se convierte
 * a cents / ISO antes de llamar a la API.
 *
 * Notas Zod 4 + RHF:
 *  - Usamos `z.number()` con `valueAsNumber: true` en `register(...)` para que
 *    RHF convierta el string del input a número. Evita `z.coerce` cuyo tipo
 *    de input (`unknown`) no encaja con el Resolver de RHF.
 *  - En Zod 4 los mensajes de error se pasan con `.min(1, 'mensaje')` o
 *    `{ error: 'mensaje' }` en el constructor (no `invalid_type_error`).
 *
 * Reglas UX (S4 — checklist del feature doc):
 *  - Si el checkbox `sold` se marca y `sold_at_date` está vacío, el form
 *    rellena automáticamente con `todayLocalDate()`.
 *  - Si el checkbox `sold` se desmarca, se limpia `sold_at_date`.
 *  - El form SIEMPRE envía `sold_at` (nunca lo deja null al marcar vendido);
 *    si `sold=false`, envía `sold_at: null`.
 */
const SaleFormSchema = z.object({
  product_name: z
    .string()
    .min(1, 'El producto es obligatorio')
    .max(200, 'Máximo 200 caracteres'),
  buyer_name: z
    .string()
    .max(200, 'Máximo 200 caracteres')
    .optional()
    .or(z.literal('')),
  cost_eur: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  price_eur: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  associated_costs_eur: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales')
    .default(0),
  purchase_date: z.string().optional().or(z.literal('')),
  sold: z.boolean().default(false),
  sold_at_date: z.string().optional().or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Máximo 5000 caracteres')
    .optional()
    .or(z.literal('')),
});

type SaleFormInput = z.input<typeof SaleFormSchema>;
type SaleFormOutput = z.output<typeof SaleFormSchema>;

interface SaleFormProps {
  /** Cuando está, el form es de edición y se pre-rellena con la venta. */
  sale?: Sale;
  /** Callback tras éxito (en lugar de navegar). */
  onSuccess?: (sale: Sale) => void;
}

export function SaleForm({ sale, onSuccess }: SaleFormProps) {
  const isEdit = !!sale;
  const navigate = useNavigate();
  const create = useCreateSale();
  const update = useUpdateSale();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SaleFormInput, unknown, SaleFormOutput>({
    resolver: zodResolver(SaleFormSchema),
    defaultValues: sale
      ? {
          product_name: sale.product_name,
          buyer_name: sale.buyer_name ?? '',
          cost_eur: centsToEuros(sale.cost_cents),
          price_eur: centsToEuros(sale.price_cents),
          associated_costs_eur: centsToEuros(sale.associated_costs_cents),
          purchase_date: sale.purchase_date ?? '',
          sold: sale.sold,
          sold_at_date: sale.sold_at ? isoToLocalDate(sale.sold_at) : '',
          notes: sale.notes ?? '',
        }
      : {
          product_name: '',
          buyer_name: '',
          cost_eur: 0,
          price_eur: 0,
          associated_costs_eur: 0,
          purchase_date: '',
          sold: false,
          sold_at_date: '',
          notes: '',
        },
  });

  // Si llega una venta nueva (por ejemplo tras un refetch), reseteamos el form.
  useEffect(() => {
    if (sale) {
      reset({
        product_name: sale.product_name,
        buyer_name: sale.buyer_name ?? '',
        cost_eur: centsToEuros(sale.cost_cents),
        price_eur: centsToEuros(sale.price_cents),
        associated_costs_eur: centsToEuros(sale.associated_costs_cents),
        purchase_date: sale.purchase_date ?? '',
        sold: sale.sold,
        sold_at_date: sale.sold_at ? isoToLocalDate(sale.sold_at) : '',
        notes: sale.notes ?? '',
      });
    }
  }, [sale, reset]);

  // Regla UX (S4): al flippear el checkbox "ya lo vendí", autocompletar la fecha
  // de venta con hoy si el usuario no la había tocado. Al desmarcar, limpiarla.
  //
  // Lo implementamos con `register('sold', { onChange })` (handler SÍNCRONO
  // en el cambio del checkbox) en vez de un `useEffect` + `watch()`. Razones:
  //  - Sin race condition con el submit: el setValue se ejecuta en el mismo tick
  //    que el cambio del checkbox, así Playwright/tests pueden hacer
  //    `check(...) → click(Submit)` sin que el form envíe `sold_at: null`.
  //  - Sin el eslint-disable de `incompatible-library` del watch.
  // Necesitamos `watch('sold')` igual para la prop `disabled` del input de fecha.
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF `watch()` no es memoizable; solo lo usamos para el `disabled` reactivo del input de fecha.
  const sold = watch('sold');

  const onSubmit: SubmitHandler<SaleFormOutput> = async (values) => {
    const soldAtDateTrim = values.sold_at_date?.trim() ?? '';
    const soldAtIso =
      values.sold && soldAtDateTrim ? localDateToISO(soldAtDateTrim) : null;

    const payload = {
      product_name: values.product_name.trim(),
      buyer_name: values.buyer_name?.trim() ? values.buyer_name.trim() : undefined,
      cost_cents: eurosToCents(values.cost_eur) as Cents,
      price_cents: eurosToCents(values.price_eur) as Cents,
      associated_costs_cents: eurosToCents(values.associated_costs_eur) as Cents,
      purchase_date:
        values.purchase_date?.trim() ? values.purchase_date.trim() : undefined,
      sold: values.sold,
      sold_at: soldAtIso,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    };

    try {
      const result = isEdit
        ? await update.mutateAsync({ id: sale.id, input: payload })
        : await create.mutateAsync(payload);
      if (onSuccess) {
        onSuccess(result);
      } else {
        navigate('/');
      }
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Producto *"
        placeholder="iPhone 12 64GB"
        autoFocus
        {...register('product_name')}
        error={errors.product_name?.message}
      />
      <Input
        label="Comprador"
        placeholder="Opcional, podés completarlo después"
        {...register('buyer_name')}
        error={errors.buyer_name?.message}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Coste (€)"
          type="number"
          step="0.01"
          min="0"
          {...register('cost_eur', { valueAsNumber: true })}
          error={errors.cost_eur?.message}
          hint="Lo que te costó el producto"
        />
        <Input
          label="Precio de venta (€)"
          type="number"
          step="0.01"
          min="0"
          {...register('price_eur', { valueAsNumber: true })}
          error={errors.price_eur?.message}
        />
        <Input
          label="Costes asociados (€)"
          type="number"
          step="0.01"
          min="0"
          {...register('associated_costs_eur', { valueAsNumber: true })}
          error={errors.associated_costs_eur?.message}
          hint="Cartón, burbuja, envío, etc."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Fecha de compra"
          type="date"
          {...register('purchase_date')}
          error={errors.purchase_date?.message}
          hint="Día que compraste el producto (opcional)"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          {...register('sold', {
            onChange: (e) => {
              const isChecked = e.target.checked;
              if (isChecked && !getValues('sold_at_date')) {
                setValue('sold_at_date', todayLocalDate(), {
                  shouldValidate: false,
                  shouldDirty: true,
                });
              }
              if (!isChecked) {
                setValue('sold_at_date', '', {
                  shouldValidate: false,
                  shouldDirty: true,
                });
              }
            },
          })}
        />
        Ya lo vendí
      </label>
      <Input
        label="Fecha de venta"
        type="date"
        disabled={!sold}
        {...register('sold_at_date')}
        error={errors.sold_at_date?.message}
        hint={
          sold
            ? 'Si la vendiste hoy, dejamos la fecha de hoy; podés cambiarla para ventas pasadas.'
            : 'Marca "Ya lo vendí" para fijar la fecha.'
        }
      />
      <Textarea
        label="Notas"
        placeholder="Lo que quieras apuntar (opcional)"
        {...register('notes')}
        error={errors.notes?.message}
      />
      {errors.root ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.root.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting || create.isPending || update.isPending}>
          {isEdit ? 'Guardar cambios' : 'Crear venta'}
        </Button>
      </div>
    </form>
  );
}
