/**
 * Página de nueva venta (S5-S6 del feature).
 *
 * Al montar, abre el ProductPickerModal (S5) para seleccionar productos.
 * Una vez confirmada la selección, muestra el form de venta con:
 *  - CustomerAutocomplete (S9)
 *  - Items seleccionados (cada uno con su cantidad editable)
 *  - sale_price, associated_costs, sold_at, notes
 *
 * Error 422 de stock insuficiente se muestra como alerta (S7).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductPickerModal } from '../../components/sales/ProductPickerModal';
import { CustomerAutocomplete } from '../../components/sales/CustomerAutocomplete';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { useCreateSold } from '../../hooks/useCreateSold';
import { todayLocalDate } from '../../lib/format';
import type { Customer } from '../../schemas/customers';

const SoldFormSchema = z.object({
  /** Items del pack [{ buy_id, quantity }]. */
  items: z
    .array(
      z.object({
        buy_id: z.number(),
        product_name: z.string(),
        quantity: z.number().int().min(1),
        /** Máximo disponible (para validar). */
        max: z.number().int().min(1),
      }),
    )
    .min(1, 'Seleccioná al menos un producto'),
  customer_id: z.number({ error: 'El cliente es obligatorio' }).int().positive(),
  sale_price: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales'),
  associated_costs: z
    .number({ error: 'Introduce un número' })
    .nonnegative('No puede ser negativo')
    .multipleOf(0.01, 'Máximo 2 decimales')
    .default(0),
  sold_at: z.string().optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
});

type SoldFormInput = z.input<typeof SoldFormSchema>;
type SoldFormOutput = z.output<typeof SoldFormSchema>;

/** Items seleccionados del pack (del modal). */
interface SelectedItem {
  buy_id: number;
  product_name: string;
  quantity: number;
  max: number;
}

/** Estructura de error 422 del server para stock insuficiente (S7). */
interface StockErrorBody {
  error: string;
  items: Array<{
    buy_id: number;
    product_name: string;
    disponibles: number;
    solicitado: number;
  }>;
}

export function SoldNewPage() {
  const navigate = useNavigate();
  const create = useCreateSold();

  /** Si hay items seleccionados, el form está visible. */
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [showModal, setShowModal] = useState(true);

  /** Cliente seleccionado (null = ninguno). */
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  /** Error de stock insuficiente del server (422). */
  const [stockError, setStockError] = useState<StockErrorBody | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SoldFormInput, unknown, SoldFormOutput>({
    resolver: zodResolver(SoldFormSchema),
    defaultValues: {
      items: [],
      sale_price: 0,
      associated_costs: 0,
      sold_at: todayLocalDate(),
      notes: '',
    },
  });

  // Sincronizar items del form con el state de items seleccionados.
  const { fields: itemFields } = useFieldArray({ control, name: 'items' });

  // Cuando el modal confirma, poblamos el form.
  const handleModalConfirm = (items: Array<{ buy_id: number; quantity: number }>) => {
    const itemMap = new Map(selectedItems.map((i) => [i.buy_id, i]));
    const merged: SelectedItem[] = items.map((i) => ({
      buy_id: i.buy_id,
      product_name: itemMap.get(i.buy_id)?.product_name ?? `Producto #${i.buy_id}`,
      quantity: i.quantity,
      max: itemMap.get(i.buy_id)?.max ?? i.quantity,
    }));
    setSelectedItems(merged);
    setShowModal(false);
    setValue(
      'items',
      merged.map((i) => ({
        buy_id: i.buy_id,
        product_name: i.product_name,
        quantity: i.quantity,
        max: i.max,
      })),
    );
  };

  const onSubmit: SubmitHandler<SoldFormOutput> = async (values) => {
    setStockError(null);

    if (!selectedCustomer) {
      setError('root', { message: 'El cliente es obligatorio' });
      return;
    }

    const payload = {
      customer_id: selectedCustomer.id,
      sale_price: values.sale_price,
      associated_costs: values.associated_costs ?? 0,
      sold_at: values.sold_at || undefined,
      notes: values.notes || undefined,
      items: values.items.map((item) => ({
        buy_id: item.buy_id,
        quantity: item.quantity,
      })),
    };

    try {
      const result = await create.mutateAsync(payload);
      navigate(`/solds/${result.id}`);
    } catch (err) {
      const apiErr = err as { status?: number; body?: StockErrorBody };
      if (apiErr?.status === 422 && apiErr?.body?.error) {
        // Error de stock insuficiente del server (S7).
        setStockError(apiErr.body as StockErrorBody);
        setError('root', { message: apiErr.body.error });
      } else if (err instanceof Error) {
        setError('root', { message: err.message });
      } else {
        setError('root', { message: 'Error desconocido' });
      }
    }
  };

  // Form visible solo cuando hay items seleccionados.
  const showForm = selectedItems.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Nueva venta</h2>
        <Link to="/solds" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← Volver
        </Link>
      </div>

      {/* Paso 1: selección de productos (modal) */}
      {!showForm && (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seleccioná los productos que vendés.
            </p>
            <Button
              className="mt-4"
              onClick={() => setShowModal(true)}
            >
              Seleccionar productos
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Paso 2: form de venta */}
      {showForm && (
        <Card>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Cliente */}
              <CustomerAutocomplete
                value={selectedCustomer}
                onChange={(c) => {
                  setSelectedCustomer(c);
                  if (c) setValue('customer_id' as keyof SoldFormOutput, c.id);
                }}
                error={
                  (errors.customer_id as { message?: string } | undefined)?.message ??
                  (errors.root?.type === 'custom' && !selectedCustomer
                    ? 'El cliente es obligatorio'
                    : undefined)
                }
              />

              {/* Items del pack (solo lectura, cantidad editable) */}
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                  Productos ({selectedItems.length})
                </legend>
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                  {itemFields.map((field, idx) => {
                    const item = selectedItems[idx];
                    const isFixed = item?.max === 1;
                    return (
                      <div
                        key={field.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                      >
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {item?.product_name ?? `Producto #${field.buy_id}`}
                        </span>
                        {isFixed ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400">1 unidad</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={item?.max ?? 1}
                              {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                              className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              / {item?.max ?? 1}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="mt-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
                  >
                    + Cambiar productos
                  </button>
                </div>
                {errors.items?.message ? (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.items.message}</p>
                ) : null}
              </fieldset>

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
                hint="Día de la venta (default hoy)"
              />

              <Textarea
                label="Notas"
                placeholder="Lo que quieras apuntar (opcional)"
                {...register('notes')}
                error={(errors.notes as { message?: string } | undefined)?.message}
              />

              {/* Error genérico */}
              {errors.root ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  {errors.root.message}
                </div>
              ) : null}

              {/* Error de stock insuficiente del server (S7). */}
              {stockError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  <p className="font-medium">{stockError.error}</p>
                  <ul className="mt-1 list-disc pl-4">
                    {stockError.items.map((item) => (
                      <li key={item.buy_id}>
                        <strong>{item.product_name}</strong>: {item.disponibles} disponibles,{' '}
                        intentaste vender {item.solicitado}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/solds')}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting || create.isPending}>
                  Crear venta
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Modal de selección de productos */}
      <ProductPickerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
}
