/**
 * Tests del hook `useTheme`. El hook lee la clase `dark` del <html> como
 * estado inicial (puesta por el script anti-FOUC de `index.html`); el init es
 * lazy, sin useEffect. El useEffect solo sincroniza clase + localStorage
 * cuando el theme cambia (Spec S1 + S5 de `feature-dark-mode.md`).
 *
 * Patrón (skill vitest + react-best-practices `rerender-lazy-state-init`):
 *  - `renderHook` para invocar el hook dentro de un TestComponent.
 *  - `act(...)` para envolver llamadas que disparan setState.
 *  - `beforeEach` resetea localStorage y la clase del documentElement para
 *    que cada test arranque desde el mismo estado base.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from '../useTheme';

const STORAGE_KEY = 'salemanteiner-theme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lee el estado inicial desde documentElement cuando la clase `dark` está', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('lee el estado inicial como light cuando la clase `dark` no está', () => {
    document.documentElement.classList.remove('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggle cambia de dark a light, actualiza la clase y persiste en localStorage', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('toggle cambia de light a dark, actualiza la clase y persiste en localStorage', () => {
    document.documentElement.classList.remove('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setLight fuerza el tema a light', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setLight();
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('setDark fuerza el tema a dark', () => {
    document.documentElement.classList.remove('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setDark();
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('no rompe si localStorage.setItem lanza (modo privado): la clase SÍ se actualiza', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('localStorage bloqueado');
      });

    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());

    expect(() => {
      act(() => {
        result.current.toggle();
      });
    }).not.toThrow();

    expect(result.current.theme).toBe('light');
    // La clase se actualiza aunque localStorage falle (es lo que el usuario ve).
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    setItemSpy.mockRestore();
  });
});
