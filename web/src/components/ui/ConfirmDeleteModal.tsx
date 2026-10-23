import { useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap({
    dialogRef,
    onEscape: () => {
      if (!isPending) onClose();
    },
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending) onClose();
  };

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
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
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
      </div>
    </div>
  );
}
