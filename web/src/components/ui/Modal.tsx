import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { useFocusTrap } from './useFocusTrap';

type ModalSize = 'compact' | 'medium' | 'wide' | 'panel';

const backdropClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

const dialogClass =
  'flex w-full flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900';

const sizeClasses: Record<ModalSize, string> = {
  compact: 'max-h-[80vh] max-w-lg overflow-y-auto',
  medium: 'max-h-[85vh] max-w-lg overflow-y-auto',
  wide: 'max-h-[90vh] max-w-2xl overflow-y-auto',
  panel: 'max-h-[80vh] max-w-lg overflow-hidden',
};

const headerClass =
  'flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800';

const titleClass = 'text-base font-semibold text-gray-900 dark:text-gray-100';

const closeButtonClass =
  'rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:text-gray-300';

export interface ModalProps {
  title: ReactNode;

  onClose: () => void;

  children?: ReactNode;

  footer?: ReactNode;

  size?: ModalSize;

  isPending?: boolean;

  initialFocusRef?: RefObject<HTMLElement | null>;

  initialFocusSelector?: string;

  describedById?: string;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'compact',
  isPending = false,
  initialFocusRef,
  initialFocusSelector,
  describedById,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap({
    dialogRef,
    onEscape: () => {
      if (!isPending) onClose();
    },
    initialFocusRef,
    initialFocusSelector,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending) onClose();
  };

  return (
    <div className={backdropClass} role="presentation" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        tabIndex={-1}
        className={`${dialogClass} ${sizeClasses[size]}`}
      >
        <div className={headerClass}>
          <h2 id={titleId} className={titleClass}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            className={closeButtonClass}
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

        {children}

        {footer}
      </div>
    </div>
  );
}
