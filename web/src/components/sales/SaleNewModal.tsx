/**
 * Modal multi-step para crear una nueva venta (S3 del feature
 * dashboard-iteration-1).
 *
 * Sustituye al flujo anterior SoldNewPage que navegaba a `/solds/new`.
 * Internamente orquesta el `ProductPickerModal` (step 1) y un form de venta
 * (step 2) con `CustomerAutocomplete`.
 *
 * Pasos:
 *  1. `ProductPickerModal` para seleccionar productos con cantidad.
 *  2. Form de venta (cliente, precio, gastos, notas, lista de items).
 *  3. Submit → `useCreateSold`, invalida ['solds'] y ['buys'].
 *
 * Patrón de montaje: el padre solo renderiza este componente cuando
 * isModalOpen es true, así cada apertura arranca con state fresco. No
 * necesitamos un useEffect para resetear el form.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductPickerModal } from './ProductPickerModal';
import { CustomerAutocomplete } from './CustomerAutocomplete';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCreateSold } from '../../hooks/useCreateSold';
import { todayLocalDate } from '../../lib/format';
import { ApiError } from '../../api/client';
import type { Customer } from '../../schemas/customers';

const SoldFormSchema = z.object({
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

/** Item seleccionado del ProductPickerModal. */
interface SelectedItem {
  buy_id: number;
  product_name: string;
  quantity: number;
  max: number;
}

/** Estructura de error 422 del server para stock insuficiente. */
interface StockErrorBody {
  error: string;
  items: Array<{
    buy_id: number;
    product_name: string;
    disponibles: number;
    solicitado: number;
  }>;
}

interface SaleNewModalProps {
  onClose: () => void;
}

export function SaleNewModal({ onClose }: SaleNewModalProps) {
  const create = useCreateSold();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const priceInputRef = useRef<HTMLInputElement>(null);

  /** Items del pack confirmados en el ProductPickerModal. */
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  /**
   * Selección inicial para el picker (S1): lo que ya está elegido. Va
   * memoizada porque el picker reinicia su estado cuando cambia la
   * referencia de la prop.
   */
  const initialSelection = useMemo(
    () => selectedItems.map((i) => ({ buy_id: i.buy_id, quantity: i.quantity })),
    [selectedItems],
  );
  /**
   * Por qué está abierto el picker de productos.
   *
   * - `'inicial'`: es el primer paso de la venta (todavía no hay nada
   *   elegido): "Cancelar" cancela la VENTA entera y cierra la modal.
   * - `'cambio'`: se abrió con "+ Cambiar productos" (ya había productos
   *   elegidos): "Cancelar" vuelve al formulario con lo que había.
   * - `null`: el picker está cerrado (se ve el formulario de la venta).
   *
   * Antes era un booleano (`showPicker`) y los dos casos compartían el
   * mismo `onClose`: cancelar el picker INICIAL te dejaba en un formulario
   * de venta sin productos (no se podía ni enviar ni cerrar sin otro
   * click).
   */
  const [motivoPicker, setMotivoPicker] = useState<'inicial' | 'cambio' | null>('inicial');
  /** Cliente seleccionado. */
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  /** Error 422 de stock insuficiente del server. */
  const [stockError, setStockError] = useState<StockErrorBody | null>(null);

  const {
    register,
    handleSubmit,
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

  // Ref combinado para el input de sale_price (register ref + focus ref).
  const salePriceReg = register('sale_price', { valueAsNumber: true });
  const setPriceInputRef = (node: HTMLInputElement | null) => {
    salePriceReg.ref(node);
    priceInputRef.current = node;
  };

  // Foco al input de precio cuando aparecen los items.
  useEffect(() => {
    if (selectedItems.length > 0 && motivoPicker === null) {
      priceInputRef.current?.focus();
    }
  }, [selectedItems, motivoPicker]);

  // Escape: si el picker está abierto, el picker lo maneja; si no, cierra el modal.
  useEffect(() => {
    if (motivoPicker !== null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, motivoPicker]);

  // Click en backdrop cierra (solo si el picker no está abierto).
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && motivoPicker === null) onClose();
  };

  const handlePickerConfirm = (
    items: Array<{ buy_id: number; product_name: string; quantity: number; max: number }>,
  ) => {
    const itemMap = new Map(selectedItems.map((i) => [i.buy_id, i]));
    const merged: SelectedItem[] = items.map((i) => ({
      buy_id: i.buy_id,
      product_name:
        i.product_name || itemMap.get(i.buy_id)?.product_name || `Producto #${i.buy_id}`,
      quantity: i.quantity,
      // Tope de la cantidad: el stock disponible que manda el picker. Antes
      // caía a la cantidad (1) cuando no había selección previa, y el item
      // quedaba "fijado en 1 unidad" sin input para cambiarla.
      max: i.max ?? itemMap.get(i.buy_id)?.max ?? i.quantity,
    }));
    setSelectedItems(merged);
    setMotivoPicker(null);
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
      await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      const apiErr = err as { status?: number; body?: StockErrorBody };
      if (apiErr?.status === 422 && apiErr?.body?.error) {
        setStockError(apiErr.body as StockErrorBody);
        setError('root', { message: apiErr.body.error });
      } else if (err instanceof ApiError) {
        setError('root', { message: err.body.error });
      } else if (err instanceof Error) {
        setError('root', { message: err.message });
      } else {
        setError('root', { message: 'Error desconocido' });
      }
    }
  };

  // Si el picker está abierto, el ProductPickerModal gestiona todo (incluido el
  // backdrop y el Escape); no renderizamos el modal padre para evitar dos
  // dialogs apilados.
  if (motivoPicker !== null) {
    return (
      <ProductPickerModal
        isOpen={true}
        initialSelection={initialSelection}
        onClose={() => {
          // Cancelar el picker INICIAL cancela la venta entera: no hay nada
          // elegido, así que lo lógico es cerrar y listo (si no, quedaba un
          // formulario de venta sin productos que no se podía enviar).
          // Cancelar el picker de "+ Cambiar productos" vuelve al formulario
          // conservando lo que ya estaba elegido.
          if (motivoPicker === 'inicial') {
            onClose();
            return;
          }
          setMotivoPicker(null);
        }}
        onConfirm={handlePickerConfirm}
      />
    );
  }

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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Nueva venta
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
              {selectedItems.map((item, idx) => {
                const isFixed = item.max === 1;
                return (
                  <div
                    key={item.buy_id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {item.product_name}
                    </span>
                    {isFixed ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">1 unidad</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label htmlFor={`qty-${item.buy_id}`} className="sr-only">
                          Cantidad para {item.product_name}
                        </label>
                        <input
                          id={`qty-${item.buy_id}`}
                          type="number"
                          min={1}
                          max={item.max}
                          defaultValue={item.quantity}
                          {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                          className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          / {item.max}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setMotivoPicker('cambio')}
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
              {...salePriceReg}
              ref={setPriceInputRef}
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

          {errors.root ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              role="alert"
            >
              {errors.root.message}
            </div>
          ) : null}

          {stockError ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              role="alert"
            >
              <p className="font-medium">{stockError.error}</p>
              <ul className="mt-1 list-disc pl-4">
                {stockError.items.map((item) => (
                  <li key={item.buy_id}>
                    <strong>{item.product_name}</strong>: {item.disponibles} disponibles, intentaste
                    vender {item.solicitado}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting || create.isPending}>
              Crear venta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
