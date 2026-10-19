/**
 * Formulario de edición de compra.
 *
 * Mismo schema que BuyNewPage, pero pre-rellena con los datos de la compra.
 * Incluye botón de eliminar.
 */
import { useEffect, useId, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useBuy } from '../../hooks/useBuy';
import { useUpdateBuy } from '../../hooks/useUpdateBuy';
import { useDeleteBuy, isDeleteBuy409, type AssociatedSale } from '../../hooks/useDeleteBuy';
import { useDeleteBuyCascade } from '../../hooks/useDeleteBuyCascade';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { formatDate } from '../../lib/format';

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
    .multipleOf(0.01, 'Máximo 2 decimales'),
  purchase_date: z.string().optional().or(z.literal('')),
});

type BuyFormInput = z.input<typeof BuyFormSchema>;
type BuyFormOutput = z.output<typeof BuyFormSchema>;

export function BuyEditPage() {
  const { id } = useParams();
  const buyId = Number(id);
  const { data: buy, isLoading, isError, error } = useBuy(buyId);
  const update = useUpdateBuy();
  const remove = useDeleteBuy();
  const cascade = useDeleteBuyCascade();
  const navigate = useNavigate();
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Modal de confirmación cascade: se abre cuando `remove` recibe 409. */
  const [deleteCascadeOpen, setDeleteCascadeOpen] = useState(false);
  /** Ventas asociadas devueltas en el 409 (para listar en la modal). */
  const [associatedSales, setAssociatedSales] = useState<AssociatedSale[] | null>(null);
  /** Error del cascade (red, 5xx). Se muestra dentro de la modal. */
  const [cascadeError, setCascadeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
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
    };

    try {
      await update.mutateAsync({ id: buyId, input: payload });
      navigate('/buys', { viewTransition: true });
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

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await remove.mutateAsync(buyId);
      navigate('/buys', { viewTransition: true });
    } catch (err) {
      // 409 con ventas asociadas → abrir modal de confirmación cascade.
      // NO mostrar el error inline (la modal ya es la confirmación).
      // Si el 409 NO trae `associated_sales` (S11), el guard devuelve false y
      // caemos en el `else`: se muestra el mensaje del server en vez de
      // dejar el click sin efecto.
      if (isDeleteBuy409(err)) {
        setAssociatedSales(err.body.associated_sales);
        setDeleteCascadeOpen(true);
        return;
      }
      setDeleteError(
        err instanceof ApiError
          ? err.body.error
          : err instanceof Error
            ? err.message
            : 'Error al eliminar',
      );
    }
  };

  const handleCascadeClose = () => {
    if (cascade.isPending) return; // No cerrar mientras está en curso.
    setDeleteCascadeOpen(false);
    setCascadeError(null);
  };

  const handleCascadeConfirm = async () => {
    setCascadeError(null);
    try {
      await cascade.mutateAsync(buyId);
      setDeleteCascadeOpen(false);
      navigate('/buys', { viewTransition: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.body.error
          : err instanceof Error
            ? err.message
            : 'Error al eliminar en cascada';
      setCascadeError(message);
    }
  };

  if (!Number.isFinite(buyId) || buyId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600 dark:text-red-400">Id de compra inválido.</p>
        <Link to="/buys" viewTransition className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
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
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar la compra: {error.message}
        </p>
        <Link to="/buys" viewTransition className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
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
        <Link to="/buys" viewTransition className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← Volver
        </Link>
      </div>

      {/* Info de registro */}
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
            />

            {errors.root ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/buys', { viewTransition: true })}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting || update.isPending}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Eliminar */}
      <Card>
        <CardBody>
          {!deleteConfirming ? (
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirming(true)}>
              Eliminar compra
            </Button>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              <p className="text-sm text-red-800 dark:text-red-300">
                ¿Eliminar <strong>"{buy.product_name}"</strong>? No se puede deshacer.
              </p>
              {deleteError ? (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400">{deleteError}</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirming(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={remove.isPending}
                  onClick={handleDelete}
                >
                  Sí, eliminar
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {deleteCascadeOpen && associatedSales ? (
        <DeleteCascadeModal
          productName={buy.product_name}
          sales={associatedSales}
          isPending={cascade.isPending}
          cascadeError={cascadeError}
          onClose={handleCascadeClose}
          onConfirm={handleCascadeConfirm}
        />
      ) : null}
    </div>
  );
}

/**
 * Modal de confirmación para el cascade delete. Se muestra cuando
 * `DELETE /api/buys/:id` devuelve 409. Lista las ventas que se van a
 * borrar (o de las que se va a quitar este buy) y exige una segunda
 * confirmación antes de llamar a `DELETE /api/buys/:id/cascade`.
 *
 * Accesibilidad (WCAG 2.2): role="dialog" + aria-modal + aria-labelledby,
 * cierre con Escape, click en backdrop, autofocus al botón destructivo.
 */
interface DeleteCascadeModalProps {
  productName: string;
  sales: AssociatedSale[];
  isPending: boolean;
  cascadeError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteCascadeModal({
  productName,
  sales,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteCascadeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // El botón destructivo usa `autoFocus` (raw <button>) en vez de un ref,
  // porque el componente Button del repo no expone ref y modificar Button
  // está fuera del scope de este cambio.

  // Escape cierra (salvo mientras la mutación está en curso).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPending, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending) onClose();
  };

  const salesCount = sales.length;
  const salesLabel = salesCount === 1 ? 'venta registrada' : 'ventas registradas';

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
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
            La compra tiene ventas asociadas
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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

        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            La compra <strong>"{productName}"</strong> tiene{' '}
            <strong>
              {salesCount} {salesLabel}
            </strong>
            . Si la borrás también se van a borrar las ventas siguientes. Esta acción
            no se puede deshacer.
          </p>

          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {sales.map((s) => {
              const unitLabel = s.items_count === 1 ? 'unidad' : 'unidades';
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <span className="font-medium">Venta #{s.id}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {s.customer_name} · {formatDate(s.sold_at)}
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    × {s.items_count} {unitLabel}
                  </span>
                </li>
              );
            })}
          </ul>

          {cascadeError ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              role="alert"
            >
              {cascadeError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            {isPending ? (
              <Button type="button" variant="danger" isLoading onClick={onConfirm}>
                Borrar también las ventas y la compra
              </Button>
            ) : (
              <button
                type="button"
                autoFocus
                onClick={onConfirm}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Borrar también las ventas y la compra
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
