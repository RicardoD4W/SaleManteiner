import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useCreateBuy } from '../../hooks/useCreateBuy';
import { todayLocalDate } from '../../lib/format';
import { apiErrorMessage } from '../../api/client';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import { BuyFormSchema, type BuyFormInput, type BuyFormOutput } from '../../schemas/forms';

interface BuyNewModalProps {
  onClose: () => void;
}

export function BuyNewModal({ onClose }: BuyNewModalProps) {
  const create = useCreateBuy();

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
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, 'Error desconocido');
      setError('root', { message });
    }
  };

  return (
    <Modal title="Nueva compra" onClose={onClose} initialFocusSelector="input">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-4">
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
