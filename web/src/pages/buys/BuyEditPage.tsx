import { useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { ProductNameAutocomplete } from '../../components/sales/ProductNameAutocomplete';
import { useBuy } from '../../hooks/useBuy';
import { useUpdateBuy } from '../../hooks/useUpdateBuy';
import { apiErrorMessage } from '../../api/client';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../../components/ui/tableStyles';
import { BuyFormSchema, type BuyFormInput, type BuyFormOutput } from '../../schemas/forms';

export function BuyEditPage() {
  const { id } = useParams();
  const buyId = Number(id);
  const { data: buy, isLoading, isError, error } = useBuy(buyId);
  const update = useUpdateBuy();
  const navigate = useNavigate();

  const transitionName = (field: string) => `buy-${field}-${buyId}`;

  const backToList = () =>
    navigate('/buys', { viewTransition: true, state: { armedRowId: buyId } });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<BuyFormInput, unknown, BuyFormOutput>({
    resolver: zodResolver(BuyFormSchema),
  });

  useEffect(() => {
    if (buy) {
      reset({
        product_name: buy.product_name,
        purchase_cost: buy.purchase_cost,
        quantity: buy.quantity,
        associated_costs: buy.associated_costs,
        purchase_date: buy.purchase_date ?? '',
        notes: buy.notes ?? '',
      });
    }
  }, [buy, reset]);

  const onSubmit: SubmitHandler<BuyFormOutput> = async (values) => {
    const payload = {
      product_name: values.product_name.trim(),
      purchase_cost: values.purchase_cost,
      quantity: values.quantity,
      associated_costs: values.associated_costs,
      purchase_date: values.purchase_date?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    try {
      await update.mutateAsync({ id: buyId, input: payload });
      backToList();
    } catch (err) {
      const message = apiErrorMessage(err, 'Error desconocido');
      setError('root', { message });
    }
  };

  if (!Number.isFinite(buyId) || buyId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-700 dark:text-red-400">Id de compra inválido.</p>
        <Link
          to="/buys"
          state={{ armedRowId: buyId }}
          viewTransition
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <Spinner size="sm" /> Cargando compra…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-700 dark:text-red-400">
          No se pudo cargar la compra: {error.message}
        </p>
        <Link
          to="/buys"
          state={{ armedRowId: buyId }}
          viewTransition
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (!buy) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Editar compra</h2>
        <Link
          to="/buys"
          state={{ armedRowId: buyId }}
          viewTransition
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← Volver
        </Link>
      </div>

      <Card>
        <CardBody className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Registrada el:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatDate(buy.created_at)}
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Controller
              control={control}
              name="product_name"
              render={({ field, fieldState }) => (
                <ProductNameAutocomplete
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  className="vt-box"
                  style={{ viewTransitionName: transitionName('product') }}
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
                className="vt-box"
                style={{ viewTransitionName: transitionName('cost') }}
              />
              <Input
                label="Cantidad *"
                type="number"
                step="1"
                min="1"
                {...register('quantity', { valueAsNumber: true })}
                error={errors.quantity?.message}
                hint="Unidades del lote"
                className="vt-box"
                style={{ viewTransitionName: transitionName('qty') }}
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
              className="vt-box"
              style={{ viewTransitionName: transitionName('associated') }}
            />

            <Input
              label="Fecha de compra"
              type="date"
              {...register('purchase_date')}
              error={errors.purchase_date?.message}
              className="vt-box"
              style={{ viewTransitionName: transitionName('date') }}
            />

            <Textarea
              label="Notas"
              placeholder="Lo que quieras apuntar de esta compra (opcional)"
              {...register('notes')}
              error={errors.notes?.message}
            />

            {errors.root ? (
              <p className={cn(errorAlertClass, 'px-3 py-2')}>{errors.root.message}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={backToList}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting || update.isPending}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
