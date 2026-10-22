/**
 * Formulario de edición de compra.
 *
 * Mismo schema que BuyNewPage, pero pre-rellena con los datos de la compra.
 *
 * El borrado NO vive acá: el usuario lo pidió así ("quitar el boton borrar
 * del apartado de editar", L5 del feature `acciones-en-listas`). Se borra
 * desde la tabla de `/buys`, con el mismo diálogo compartido
 * (`components/sales/DeleteDialogs.tsx`).
 */
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link, useViewTransitionState } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useBuy } from '../../hooks/useBuy';
import { useUpdateBuy } from '../../hooks/useUpdateBuy';
import { ApiError } from '../../api/client';
import { formatDate } from '../../lib/format';

const BuyFormSchema = z.object({
  product_name: z.string().min(1, 'El producto es obligatorio').max(200, 'Máximo 200 caracteres'),
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
  const navigate = useNavigate();

  /**
   * Nombre de la view transition de elemento compartido (S3).
   *
   * Es el MISMO nombre que lleva la celda de la fila en `/buys`: así el
   * valor de cada campo viaja de la tabla al formulario. La clave es el id
   * de la compra (el nombre del producto no sirve como
   * `view-transition-name`: tiene espacios y puede repetirse) y `campo`
   * distingue los campos (cada input tiene su pareja en la fila).
   */
  const nombreTransicion = (campo: string) => `buy-${campo}-${buyId}`;

  /**
   * ¿La página llegó por una view transition? (el router la está entrando).
   *
   * Si llega así, los campos del formulario entran con un fade corto al
   * terminar la transición (ver `.vt-entra` en `index.css`): durante el
   * vuelo la foto del input se oculta (se deformaría al estirarse) y sin
   * esto los campos aparecerían de golpe.
   */
  const transicionando = useViewTransitionState(`/buys/${buyId}`);
  const [llegoPorTransicion] = useState(() => transicionando);

  /**
   * Vuelve a la lista dejando armada la fila de esta compra (S3): el id
   * viaja en el `state` de la navegación y la lista lo lee para armar la
   * fila (y que el producto vuelva a la celda).
   */
  const volverALista = () =>
    navigate('/buys', { viewTransition: true, state: { filaArmada: buyId } });

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
      volverALista();
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

  if (!Number.isFinite(buyId) || buyId <= 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600 dark:text-red-400">Id de compra inválido.</p>
        <Link
          to="/buys"
          state={{ filaArmada: buyId }}
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
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar la compra: {error.message}
        </p>
        <Link
          to="/buys"
          state={{ filaArmada: buyId }}
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
          state={{ filaArmada: buyId }}
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
            <span>Registrada el:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatDate(buy.created_at)}
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={`space-y-4${llegoPorTransicion ? ' vt-entra' : ''}`}
          >
            <Input
              label="Producto *"
              placeholder="Funda iPhone 15"
              autoFocus
              {...register('product_name')}
              error={errors.product_name?.message}
              // S3: este input es el destino de la transición de elemento
              // compartido (el mismo nombre que la celda de la fila).
              // `vt-caja`: el texto de la celda viaja como chip y la
              // caja del input no se dibuja en el vuelo (ver index.css).
              className="vt-caja"
              style={{ viewTransitionName: nombreTransicion('product') }}
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
                // S3: este input es el destino del chip del coste.
                className="vt-caja"
                style={{ viewTransitionName: nombreTransicion('cost') }}
              />
              <Input
                label="Cantidad *"
                type="number"
                step="1"
                min="1"
                {...register('quantity', { valueAsNumber: true })}
                error={errors.quantity?.message}
                hint="Unidades del lote"
                // S3: este input es el destino del chip de la cantidad.
                className="vt-caja"
                style={{ viewTransitionName: nombreTransicion('qty') }}
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
              // S3: este input es el destino del chip de los asociados.
              className="vt-caja"
              style={{ viewTransitionName: nombreTransicion('associated') }}
            />

            <Input
              label="Fecha de compra"
              type="date"
              {...register('purchase_date')}
              error={errors.purchase_date?.message}
              // S3: este input es el destino del chip de la fecha.
              className="vt-caja"
              style={{ viewTransitionName: nombreTransicion('date') }}
            />

            {errors.root ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={volverALista}>
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
