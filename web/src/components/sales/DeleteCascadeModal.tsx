/**
 * Modal de confirmación del borrado en cascada (S2 del feature
 * `acciones-en-listas`).
 *
 * Es el diálogo que aparece cuando el server rechaza el borrado simple
 * porque el registro tiene ventas asociadas (409). Nombra las ventas que
 * se van a borrar y exige una segunda confirmación antes de llamar al
 * endpoint de cascada.
 *
 * La usan las compras (`DeleteBuyModal`) y los clientes
 * (`DeleteCustomerModal`): los dos son el MISMO diálogo con distinto
 * texto, así que el markup vive acá una sola vez y los wrappers pasan las
 * palabras.
 *
 * Accesibilidad (WCAG 2.2): `role="dialog"` + `aria-modal="true"` +
 * `aria-labelledby`, focus trap (Tab/Shift+Tab ciclan dentro), cierre con
 * Escape y click en el backdrop, foco inicial en el botón destructivo y
 * error de la cascada anunciado con `role="alert"`.
 */
import { useId, useRef } from 'react';
import { Button } from '../ui/Button';
import { useFocusTrap } from '../ui/useFocusTrap';
import { formatDate } from '../../lib/format';

/** Venta que se va a borrar (la forma del 409 del server). */
export interface CascadeSale {
  id: number;
  customer_name: string;
  sold_at: string | null;
  items_count: number;
}

export interface DeleteCascadeModalProps {
  /** Título del diálogo (es su nombre accesible). */
  title: string;
  /** Nombre del registro que se va a borrar (el producto o el cliente). */
  entityName: string;
  /** Cómo se llama el registro en la frase: "La compra" / "El cliente". */
  entityPhrase: string;
  /** Pronombre del registro: "la" / "lo". */
  entityPronoun: string;
  /** Texto del botón destructivo. */
  confirmLabel: string;
  /** Ventas que se van a borrar. */
  sales: CascadeSale[];
  /** `true` mientras el borrado en cascada está en curso. */
  isPending: boolean;
  /** Error del borrado en cascada (red, 5xx). Se muestra en la modal. */
  cascadeError: string | null;
  /** Cierre (Escape, backdrop o "Cancelar"). */
  onClose: () => void;
  /** Confirmación del borrado en cascada. */
  onConfirm: () => void;
}

export function DeleteCascadeModal({
  title,
  entityName,
  entityPhrase,
  entityPronoun,
  confirmLabel,
  sales,
  isPending,
  cascadeError,
  onClose,
  onConfirm,
}: DeleteCascadeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Id del título: `useId` para que dos modales montados a la vez no
  // compartan el mismo id (el `aria-labelledby` tiene que apuntar a uno).
  const titleId = useId();
  // El botón destructivo usa un <button> "crudo" (y no el `Button` del
  // repo) porque ese componente no expone `ref`: hace falta la ref para
  // apuntar el foco inicial del focus trap.
  //
  // OJO: el botón NO lleva `autoFocus`. React aplica el `autoFocus` en la
  // fase de commit, ANTES de los efectos: si lo tuviera, el efecto que
  // memoriza "el elemento que tenía el foco antes de abrir la modal"
  // (para devolvérselo al cerrar) ya vería el foco en el botón
  // destructivo y no en el "Borrar" de la fila. El foco inicial lo pone
  // el focus trap (`initialFocusRef`), con el mismo efecto observable.
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    dialogRef,
    enabled: true,
    onEscape: () => {
      // Escape no cierra mientras la mutación está en curso.
      if (!isPending) onClose();
    },
    initialFocusRef: confirmButtonRef,
  });

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
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {entityPhrase} <strong>"{entityName}"</strong> tiene{' '}
            <strong>
              {salesCount} {salesLabel}
            </strong>
            . Si {entityPronoun} borrás también se van a borrar las ventas siguientes. Esta acción
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
      </div>
    </div>
  );
}
