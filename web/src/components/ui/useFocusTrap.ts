/**
 * Focus trap + devolución del foco para los diálogos de la app.
 *
 * Comportamiento (WCAG 2.2, patrón de
 * `web/.agents/skills/accessibility/references/A11Y-PATTERNS.md`):
 *  - Al abrir: el foco entra al diálogo (al `initialFocusRef` o al primer
 *    elemento focusable).
 *  - Tab / Shift+Tab: ciclan dentro del diálogo (nunca salen).
 *  - Escape: delega en `onEscape`.
 *  - Al cerrar: el foco vuelve al elemento que tenía el foco antes de
 *    abrir (normalmente el botón que abrió la modal).
 *
 * Vive en su propio archivo (y no dentro de un componente) porque lo usan
 * tres diálogos: la confirmación de borrado, la cascada de compras y el
 * alta/edición de cliente. Duplicarlo sería una fuente de inconsistencias.
 */
import { useEffect, useRef, type RefObject } from 'react';

/** Elementos que reciben foco dentro de un diálogo. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Elementos focusables dentro de `root`, en orden de DOM. */
function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface FocusTrapOptions {
  /** Ref al contenedor del diálogo. */
  dialogRef: RefObject<HTMLElement | null>;
  /** Si es `false`, el trap está desactivado (la modal no está abierta). */
  enabled: boolean;
  /** Callback al pulsar Escape. */
  onEscape: () => void;
  /**
   * Elemento que recibe el foco al abrir. Si no se pasa, el foco va al
   * primer elemento focusable del diálogo (y, si no hay ninguno, al propio
   * contenedor, que tiene `tabIndex={-1}`).
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useFocusTrap({
  dialogRef,
  enabled,
  onEscape,
  initialFocusRef,
}: FocusTrapOptions): void {
  // El callback se guarda en un ref para que el listener de teclado no se
  // reinstale en cada render (si se reinstalara, volvería a capturar el
  // elemento activo y lo devolvería al foco en un momento inesperado).
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  // Foco al abrir + devolución del foco al elemento disparador al cerrar.
  useEffect(() => {
    if (!enabled) return;
    const previouslyFocused = document.activeElement;
    const node = dialogRef.current;
    const target = initialFocusRef?.current ?? getFocusableElements(node)[0] ?? node;
    target?.focus();
    return () => {
      // Si el elemento disparador ya no está en el DOM (p. ej. la fila se
      // borró), no hay a dónde devolver el foco.
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [enabled, dialogRef, initialFocusRef]);

  // Trap de teclado (Tab / Shift+Tab) + Escape.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = dialogRef.current;
      if (!node) return;
      const items = getFocusableElements(node);
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      let next: number;
      if (current === -1) {
        // El foco está fuera del diálogo: entra por un extremo.
        next = e.shiftKey ? items.length - 1 : 0;
      } else if (e.shiftKey) {
        next = (current - 1 + items.length) % items.length;
      } else {
        next = (current + 1) % items.length;
      }
      items[next]?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, dialogRef]);
}
