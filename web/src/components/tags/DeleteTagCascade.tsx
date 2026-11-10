import { formatDate, formatEuro } from '../../lib/format';
import { Button } from '../ui/Button';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import type { BuyWithStock } from '../../api/buys';

interface DeleteTagCascadeProps {
  tagName: string;

  buys: BuyWithStock[];

  isPending: boolean;

  error: string | null;

  onCancel: () => void;

  onConfirm: () => void;
}

export function DeleteTagCascade({
  tagName,
  buys,
  isPending,
  error,
  onCancel,
  onConfirm,
}: DeleteTagCascadeProps) {
  const count = buys.length;
  const countLabel = count === 1 ? '1 compra' : `${count} compras`;
  const pronoun = count === 1 ? 'esa compra' : 'esas compras';
  const verb = count === 1 ? 'se queda' : 'se quedan';
  const head = count === 0 ? 'no tiene compras' : `tiene ${countLabel}`;
  const tail =
    count === 0
      ? 'Si lo borrás, no cambia nada.'
      : `Si lo borrás, ${pronoun} ${verb} sin etiqueta. Las compras no se borran.`;

  return (
    <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
      <p className="text-sm text-gray-800 dark:text-gray-100">
        El tag <strong>«{tagName}»</strong> {head}. {tail}
      </p>

      {count > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-red-200 bg-white dark:divide-gray-800 dark:border-red-800 dark:bg-gray-900">
          {buys.map((buy) => (
            <li
              key={buy.id}
              className="flex items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
            >
              <span className="font-medium">{buy.product_name}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(buy.purchase_date)} · {formatEuro(buy.total_cost)}
              </span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                × {buy.quantity} {buy.quantity === 1 ? 'unidad' : 'unidades'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="button" variant="danger" size="sm" isLoading={isPending} onClick={onConfirm}>
          Sí, borrar el tag
        </Button>
      </div>
    </div>
  );
}
