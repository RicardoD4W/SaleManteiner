import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimatedRows } from '../useAnimatedRows';

interface Row {
  id: number;
  name: string;
}

const row = (id: number, name = `row-${id}`): Row => ({ id, name });

function renderRows(initial: Row[], generation = '') {
  return renderHook(
    ({ items, gen }: { items: Row[]; gen: string }) => useAnimatedRows(items, gen),
    { initialProps: { items: initial, gen: generation } },
  );
}

describe('useAnimatedRows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hace entrar a todas las filas de la lista inicial', () => {
    const { result } = renderRows([row(1), row(2)]);

    expect(result.current.rows.map((item) => item.id)).toEqual([1, 2]);
    expect(result.current.rowClassName(1)).toBe('animate-row-in');
    expect(result.current.rowClassName(2)).toBe('animate-row-in');
  });

  it('hace entrar a la fila nueva y deja intactas las que ya estaban', () => {
    const { result, rerender } = renderRows([row(1)]);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.rowClassName(1)).toBeUndefined();

    rerender({ items: [row(1), row(2)], gen: '' });

    expect(result.current.rowClassName(1)).toBeUndefined();
    expect(result.current.rowClassName(2)).toBe('animate-row-in');
  });

  it('deja la fila que desaparece en la lista con la animación de salida', () => {
    const { result, rerender } = renderRows([row(1), row(2)]);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ items: [row(1)], gen: '' });

    expect(result.current.rows.map((item) => item.id)).toEqual([1, 2]);
    expect(result.current.rowClassName(2)).toBe('animate-row-out');
    expect(result.current.rowClassName(1)).toBeUndefined();
  });

  it('mantiene la fila que sale en su posición', () => {
    const { result, rerender } = renderRows([row(1), row(2), row(3)]);

    rerender({ items: [row(1), row(3)], gen: '' });

    expect(result.current.rows.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('retira la fila cuando termina la animación de salida', () => {
    const { result, rerender } = renderRows([row(1), row(2)]);

    rerender({ items: [row(1)], gen: '' });

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(result.current.rows.map((item) => item.id)).toEqual([1, 2]);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.rows.map((item) => item.id)).toEqual([1]);
  });

  it('hace salir a varias filas a la vez', () => {
    const { result, rerender } = renderRows([row(1), row(2), row(3)]);

    rerender({ items: [row(1)], gen: '' });

    expect(result.current.rowClassName(2)).toBe('animate-row-out');
    expect(result.current.rowClassName(3)).toBe('animate-row-out');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.rows.map((item) => item.id)).toEqual([1]);
  });

  it('vuelve a animar todas las filas cuando cambia el filtro', () => {
    const { result, rerender } = renderRows([row(1), row(2)]);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.rowClassName(1)).toBeUndefined();

    rerender({ items: [row(1), row(2), row(3)], gen: '2026-01-01' });

    expect(result.current.rowClassName(1)).toBe('animate-row-in');
    expect(result.current.rowClassName(2)).toBe('animate-row-in');
    expect(result.current.rowClassName(3)).toBe('animate-row-in');
    expect(result.current.rowKey(1)).toBe('2026-01-01:1');
  });

  it('no vuelve a animar las filas cuando los datos se recargan sin cambios', () => {
    const { result, rerender } = renderRows([row(1), row(2)]);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ items: [row(1), row(2)], gen: '' });

    expect(result.current.rowClassName(1)).toBeUndefined();
    expect(result.current.rowClassName(2)).toBeUndefined();
  });

  it('con prefers-reduced-motion la fila desaparece sin esperar a la animación', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    const { result, rerender } = renderRows([row(1), row(2)]);

    rerender({ items: [row(1)], gen: '' });

    expect(result.current.rowClassName(2)).toBe('animate-row-out');

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.rows.map((item) => item.id)).toEqual([1]);
  });
});
