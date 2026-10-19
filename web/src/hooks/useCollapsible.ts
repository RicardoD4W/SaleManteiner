/**
 * Hook para secciones colapsables con persistencia en localStorage.
 *
 * Usado por OverviewTab para los Top 5 (S6 del feature
 * dashboard-iteration-1). El estado se guarda en localStorage con la clave
 * provista, en formato `'true'` o `'false'`. Default = expandido.
 *
 * Accesibilidad: el consumidor es responsable de pasar `aria-expanded` y
 * `aria-controls` al header/botón. El hook solo maneja el estado.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_TRUE = 'true';
const STORAGE_FALSE = 'false';

function readStoredValue(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === STORAGE_TRUE) return true;
    if (stored === STORAGE_FALSE) return false;
    return defaultValue;
  } catch {
    // localStorage puede fallar en modo privado o por quotas.
    return defaultValue;
  }
}

export function useCollapsible(key: string, defaultValue = false): {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (next: boolean) => void;
} {
  // Lazy init: solo se lee localStorage en el primer render.
  const [isOpen, setIsOpen] = useState<boolean>(() => readStoredValue(key, defaultValue));

  // Persistir cada cambio.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, isOpen ? STORAGE_TRUE : STORAGE_FALSE);
    } catch {
      // Ignorar errores de quota / modo privado.
    }
  }, [key, isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
  }, []);

  return { isOpen, toggle, setOpen };
}
