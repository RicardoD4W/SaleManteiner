import { useSyncExternalStore } from 'react';

/**
 * Tema tal y como está aplicado en el DOM (la clase `dark` del <html>).
 *
 * El `<Toaster>` de sileo necesita saber el tema para pintar el fondo y el
 * color del texto del toast (`theme` → `data-theme` en su viewport). La app
 * lo gestiona con un estado local en cada componente que usa `useTheme` (el
 * toggle del header), así que la única fuente de verdad compartida es la
 * clase del <html>: este hook la observa y se actualiza solo cuando cambia.
 *
 * No duplica la lógica de `useTheme`: solo lee lo que ya está en el DOM.
 */
export type DomTheme = 'light' | 'dark';

function subscribe(onCambio: () => void): () => void {
  const observer = new MutationObserver(onCambio);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getSnapshot(): DomTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Tema aplicado en el DOM, sincronizado con el toggle del header. */
export function useDomTheme(): DomTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
