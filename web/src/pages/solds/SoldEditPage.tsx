/**
 * Página de edición de venta.
 *
 * Carga la venta con `soldsApi.getByIdWithItems` para obtener los items del pack.
 * Permite editar: cliente, precio, asociados, fecha, notas.
 * Los items del pack NO se pueden editar (son inmutables una vez creada la venta).
 *
 * El borrado NO vive acá: el usuario lo pidió así ("quitar el boton borrar
 * del apartado de editar", L5 del feature `acciones-en-listas`). Se borra
 * desde la tabla de `/solds`, con el mismo diálogo compartido
 * (`components/sales/DeleteDialogs.tsx`).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CustomerAutocomplete } from '../../components/sales/CustomerAutocomplete';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useSold } from '../../hooks/useSold';
import { useUpdateSold } from '../../hooks/useUpdateSold';
import { formatDate } from '../../lib/format';
import { ApiError } from '../../api/client';
import type { Customer } from '../../schemas/customers';
import { soldsApi } from '../../api/solds';
import type { SoldWithItems } from '../../schemas/solds';

const SoldEditFormSchema = z.object({
  customer_id: z.number({ error: 'El cliente es obligatorio' }).int().positive(),
  sale_price: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  associated_costs: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  sold_at: z.string().optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
});

type SoldEditFormInput = z.input<typeof SoldEditFormSchema>;
type SoldEditFormOutput = z.output<typeof SoldEditFormSchema>;

export function SoldEditPage() {
  const { id } = useParams();
  const soldId = Number(id);
  const { data: sold, isLoading, isError, error } = useSold(soldId);
  const update = useUpdateSold();
  const navigate = useNavigate();
  const [soldWithItems, setSoldWithItems] = useState<SoldWithItems | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SoldEditFormInput, unknown, SoldEditFormOutput>({
    resolver: zodResolver(SoldEditFormSchema),
  });

  // Cargar detalle con items.
  useEffect(() => {
    if (!Number.isFinite(soldId) || soldId <= 0) return;
    if (!sold) return;
    soldsApi
      .getByIdWithItems(soldId)
      .then((detailed) => {
        setSoldWithItems(detailed);
        setSelectedCustomer({
          id: detailed.customer_id,
          name: detailed.customer_name,
          created_at: '',
        });
        reset({
          customer_id: detailed.customer_id,
          sale_price: detailed.sale_price,
          associated_costs: detailed.associated_costs,
          sold_at: detailed.sold_at ?? '',
          notes: detailed.notes ?? '',
        });
      })
      .catch(() => {
        // Silenciar error de items; el form sigue funcionando sin el detalle.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se ejecuta cuando cambia `sold`
  }, [sold]);

  const onSubmit: SubmitHandler<SoldEditFormOutput> = async (values) => {
    const payload = {
      customer_id: selectedCustomer ? selectedCustomer.id : values.customer_id,
      sale_price: values.sale_price,
      associated_costs: values.associated_costs,
      sold_at: values.sold_at?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    try {
      await update.mutateAsync({ id: soldId, input: payload });
      navigate('/solds', { viewTransition: true });
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

  if (!Number.isFinite(soldId) || soldId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600 dark:text-red-400">Id de venta inválido.</p>
        <Link
          to="/solds"
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
        <Spinner size="sm" /> Cargando venta…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar la venta: {error.message}
        </p>
        <Link
          to="/solds"
          viewTransition
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  if (!sold) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Editar venta</h2>
        <Link
          to="/solds"
          viewTransition
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← Volver
        </Link>
      </div>

      {/* Info de registro */}
      <Card>
        <CardBody className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Registrado el:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatDate(sold.created_at)}
            </span>
          </div>
          {sold.sold_at ? (
            <div className="flex justify-between">
              <span>Vendido el:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {formatDate(sold.sold_at)}
              </span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Items del pack (solo lectura) */}
      {soldWithItems && soldWithItems.items.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Productos ({soldWithItems.items.length})
            </h3>
            <ul className="space-y-1">
              {soldWithItems.items.map((item) => (
                <li
                  key={item.buy_id}
                  className="flex justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <span className="text-gray-800 dark:text-gray-200">{item.product_name}</span>
                  <span className="text-gray-500 dark:text-gray-400">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <CustomerAutocomplete
              value={selectedCustomer}
              onChange={(c) => {
                setSelectedCustomer(c);
                if (c) setValue('customer_id' as keyof SoldEditFormOutput, c.id);
              }}
              error={(errors.customer_id as { message?: string } | undefined)?.message}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Precio total de venta (€) *"
                type="number"
                step="0.01"
                min="0"
                autoFocus
                {...register('sale_price', { valueAsNumber: true })}
                error={(errors.sale_price as { message?: string } | undefined)?.message}
              />
              <Input
                label="Gastos asociados (€)"
                type="number"
                step="0.01"
                min="0"
                {...register('associated_costs', { valueAsNumber: true })}
                error={(errors.associated_costs as { message?: string } | undefined)?.message}
                hint="Envío, comisión, etc. (opcional)"
              />
            </div>

            <Input
              label="Fecha de venta"
              type="date"
              {...register('sold_at')}
              error={(errors.sold_at as { message?: string } | undefined)?.message}
            />

            <Textarea
              label="Notas"
              placeholder="Lo que quieras apuntar (opcional)"
              {...register('notes')}
              error={(errors.notes as { message?: string } | undefined)?.message}
            />

            {errors.root ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/solds', { viewTransition: true })}
              >
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
