/**
 * Modal genérica de confirmación de borrado (S2 del feature
 * `acciones-en-listas`).
 *
 * Es el diálogo que usan las tablas de `/buys` y `/solds` para confirmar
 * un borrado. El texto de la confirmación lo pasa quien la usa (así la
 * compra y la venta pueden decir cosas distintas) pero el comportamiento
 * (foco, cierre, error) es siempre el mismo.
 *
 * Accesibilidad (WCAG 2.2):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (y
 *    `aria-describedby` con la descripción).
 *  - Focus trap: Tab / Shift+Tab ciclan dentro del diálogo (patrón de
 *    `web/.agents/skills/accessibility/references/A11Y-PATTERNS.md`).
 *  - Escape cierra (salvo mientras la mutación está en curso).
 *  - Click en el backdrop cierra.
 *  - El foco entra en el diálogo al abrir y vuelve al elemento disparador
 *    al cerrar.
 *  - El error se anuncia con `role="alert"`.
 */
import { useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';

export interface ConfirmDeleteModalProps {
  /** Título del diálogo (es su nombre accesible). */
  title: string;
  /** Qué se va a borrar. */
  description: ReactNode;
  /** Error del borrado (red, 5xx). Se anuncia con `role="alert"`. */
  error?: string | null;
  /** `true` mientras la mutación está en curso (bloquea el cierre). */
  isPending?: boolean;
  /** Texto del botón destructivo. */
  confirmLabel: string;
  /** Cierre (Escape, backdrop o "Cancelar"). */
  onClose: () => void;
  /** Confirmación del borrado. */
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
    enabled: true,
    onEscape: () => {
      // Escape no cierra mientras la mutación está en curso: si no, el
      // usuario vería la modal desaparecer con el borrado a medias.
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
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
            >
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
