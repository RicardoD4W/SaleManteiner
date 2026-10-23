import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

interface FocusTrapOptions {
  dialogRef: RefObject<HTMLElement | null>;

  onEscape: () => void;

  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useFocusTrap({ dialogRef, onEscape, initialFocusRef }: FocusTrapOptions): void {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const node = dialogRef.current;
    const target = initialFocusRef?.current ?? getFocusableElements(node)[0] ?? node;
    target?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [dialogRef, initialFocusRef]);

  useEffect(() => {
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
  }, [dialogRef]);
}
