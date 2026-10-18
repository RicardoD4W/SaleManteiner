/**
 * Formulario de nueva compra (S4 del feature).
 *
 * Campos: product_name, purchase_cost (€), quantity (default 1),
 * associated_costs (€ opcional), purchase_date (date default hoy).
 *
 * Los importes van en euros decimales directo (no conversión a céntimos).
 */
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
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

export function BuyNewPage() {
  const navigate = useNavigate();
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
      const result = await create.mutateAsync(payload);
      navigate(`/buys/${result.id}`);
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
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Nueva compra</h2>
        <Link
          to="/buys"
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← Volver
        </Link>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Producto *"
              placeholder="Funda iPhone 15"
              autoFocus
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
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/buys')}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting || create.isPending}>
                Crear compra
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
