import { useCallback, useEffect, useState } from 'react';

/**
 * Tema visual de la app: 'light' | 'dark'.
 *
 * Reglas aplicadas (skills):
 *  - `rerender-lazy-state-init`: el tema inicial se lee UNA vez desde la clase
 *    `dark` del <html> (puesta por el script anti-FOUC de `index.html`), no en
 *    un useEffect posterior.
 *  - `rerender-derived-state-no-effect`: no duplicamos el estado derivándolo en
 *    un effect; el useEffect solo sincroniza clase + localStorage cuando theme
 *    cambia, no lee el estado para algo.
 *  - `client-localstorage-schema`: clave versionada (`salemanteiner-theme`) con
 *    valores controlados. Si el valor está corrupto o no está, se ignora.
 *  - `rerender-functional-setstate`: `toggle` usa la forma funcional.
 *
 * Default si no hay nada en localStorage: respetar `prefers-color-scheme` del
 * SO; si no hay match, arrancar en dark (Spec S1 de `feature-dark-mode.md`).
 *
 * El cambio visual se aplica sincronizando:
 *  - `document.documentElement.classList` (clase `dark` para Tailwind 4
 *    `@custom-variant dark`).
 *  - `localStorage` (persistencia entre sesiones).
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'salemanteiner-theme';

function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
  return 'dark';
}

export interface UseTheme {
  theme: Theme;
  toggle: () => void;
  setLight: () => void;
  setDark: () => void;
}

export function useTheme(): UseTheme {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage puede estar bloqueado (modo privado); seguir sin persistir.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const setLight = useCallback(() => setTheme('light'), []);
  const setDark = useCallback(() => setTheme('dark'), []);

  return { theme, toggle, setLight, setDark };
}
