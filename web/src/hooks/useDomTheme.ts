import { useSyncExternalStore } from 'react';

type DomTheme = 'light' | 'dark';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getSnapshot(): DomTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useDomTheme(): DomTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
