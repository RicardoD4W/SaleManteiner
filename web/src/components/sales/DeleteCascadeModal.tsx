import { useRef } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/classNames';
import { useAnimatedClose } from '../../hooks/useExitAnimation';
import { useAnimatedRows } from '../../hooks/useAnimatedRows';
import { errorAlertClass } from '../ui/tableStyles';

interface CascadeItem {
  id: number;
  title: string;
  description: string;
  badge: string;
}

interface DeleteCascadeModalProps {
  title: string;

  entityName: string;

  entityPhrase: string;

  entityPronoun: string;

  confirmLabel: string;

  countLabelSingular: string;

  countLabelPlural: string;

  itemsNoun: string;

  items: CascadeItem[];

  isPending: boolean;

  cascadeError: string | null;

  onClose: () => void;

  onConfirm: () => void;
}

export function DeleteCascadeModal({
  title,
  entityName,
  entityPhrase,
  entityPronoun,
  confirmLabel,
  countLabelSingular,
  countLabelPlural,
  itemsNoun,
  items,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteCascadeModalProps) {
  const { closing, close } = useAnimatedClose(onClose);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const { rows: itemRows, rowClassName, rowKey } = useAnimatedRows(items);

  const itemsCount = items.length;
  const countLabel = itemsCount === 1 ? countLabelSingular : countLabelPlural;

  return (
    <Modal
      title={title}
      onClose={close}
      exiting={closing}
      isPending={isPending}
      size="medium"
      initialFocusRef={confirmButtonRef}
    >
      <div className="space-y-4 p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {entityPhrase} <strong>"{entityName}"</strong> tiene{' '}
          <strong>
            {itemsCount} {countLabel}
          </strong>
          . Si {entityPronoun} borrás también se van a borrar {itemsNoun} siguientes. Esta acción no
          se puede deshacer.
        </p>

        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {itemRows.map((item) => (
            <li
              key={rowKey(item.id)}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-gray-200',
                rowClassName(item.id),
              )}
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-gray-500 dark:text-gray-400">{item.description}</span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {item.badge}
              </span>
            </li>
          ))}
        </ul>

        {cascadeError ? (
          <p className={cn(errorAlertClass, 'px-3 py-2')} role="alert">
            {cascadeError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
            Cancelar
          </Button>
          {isPending ? (
            <Button type="button" variant="danger" isLoading onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : (
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
