import { useId } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ProductNameAutocomplete } from './ProductNameAutocomplete';
import { BuyLotTotal } from './BuyLotTotal';
import { useCreateBuy } from '../../hooks/useCreateBuy';
import { useTags } from '../../hooks/useTags';
import { todayLocalDate } from '../../lib/format';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import { BuyFormSchema, type BuyFormInput, type BuyFormOutput } from '../../schemas/forms';
import type { CreateBuyInput } from '../../schemas/buys';

interface BuyNewModalProps {
  onClose: () => void;
}

const selectClass =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export function BuyNewModal({ onClose }: BuyNewModalProps) {
  const create = useCreateBuy();
  const { data: tags } = useTags('buy');
  const tagSelectId = useId();

  const {
    register,
    handleSubmit,
    control,
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
      notes: '',
      tag_id: null,
    },
  });

  const onSubmit: SubmitHandler<BuyFormOutput> = async (values) => {
    const payload: CreateBuyInput = {
      product_name: values.product_name.trim(),
      purchase_cost: values.purchase_cost,
      quantity: values.quantity,
      associated_costs: values.associated_costs,
      purchase_date: values.purchase_date?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      tag_id: values.tag_id ?? null,
    };

    try {
      await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, 'Error desconocido');
      setError('root', { message });
    }
  };

  return (
    <Modal title="Nueva compra" onClose={onClose} initialFocusSelector="input">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-4">
        <Controller
          control={control}
          name="product_name"
          render={({ field, fieldState }) => (
            <ProductNameAutocomplete
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Precio unidad (€) *"
            type="number"
            step="0.01"
            min="0"
            {...register('purchase_cost', { valueAsNumber: true })}
            error={errors.purchase_cost?.message}
            hint="Lo que pagaste por una unidad"
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

        <BuyLotTotal control={control} />

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

        <Textarea
          label="Notas"
          placeholder="Lo que quieras apuntar de esta compra (opcional)"
          {...register('notes')}
          error={errors.notes?.message}
        />

        <div className="space-y-2">
          <label
            htmlFor={tagSelectId}
            className="text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            Tag
          </label>
          <Controller
            control={control}
            name="tag_id"
            render={({ field }) => (
              <select
                id={tagSelectId}
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? null : Number(event.target.value))
                }
                className={cn(selectClass)}
              >
                <option value="">Sin tag</option>
                {(tags ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
          />
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
          <Button type="submit" isLoading={isSubmitting || create.isPending}>
            Crear compra
          </Button>
        </div>
      </form>
    </Modal>
  );
}
