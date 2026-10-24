import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from './tableStyles';

interface ConfirmDeleteModalProps {
  title: string;

  description: ReactNode;

  error?: string | null;

  isPending?: boolean;

  confirmLabel: string;

  onClose: () => void;

  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  title,
  description,
  error = null,
  isPending = false,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const descriptionId = useId();

  return (
    <Modal
      title={title}
      onClose={onClose}
      isPending={isPending}
      size="medium"
      describedById={descriptionId}
    >
      <div className="space-y-4 p-4">
        <div id={descriptionId} className="text-sm text-gray-700 dark:text-gray-300">
          {description}
        </div>

        {error ? (
          <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" isLoading={isPending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
