import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimatedClose, EXIT_ANIMATION_MS } from '../useExitAnimation';

describe('useAnimatedClose', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marca que se está cerrando y ejecuta el cierre cuando termina la animación', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useAnimatedClose(onDone));

    expect(result.current.closing).toBe(false);

    act(() => {
      result.current.close();
    });

    expect(result.current.closing).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.closing).toBe(false);
  });

  it('no cierra antes de que termine la animación de salida', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useAnimatedClose(onDone));

    expect(EXIT_ANIMATION_MS).toBe(200);

    act(() => {
      result.current.close();
    });

    act(() => {
      vi.advanceTimersByTime(EXIT_ANIMATION_MS - 1);
    });

    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('permite pasar un cierre propio en lugar del del hook', () => {
    const onDone = vi.fn();
    const custom = vi.fn();
    const { result } = renderHook(() => useAnimatedClose(onDone));

    act(() => {
      result.current.closeWith(custom);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(custom).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('ignora un segundo cierre mientras el primero sigue en curso', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useAnimatedClose(onDone));

    act(() => {
      result.current.close();
      result.current.close();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancelar evita el cierre', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useAnimatedClose(onDone));

    act(() => {
      result.current.close();
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.closing).toBe(false);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDone).not.toHaveBeenCalled();
  });

  it('usa el cierre más reciente cuando el callback cambia', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onDone }) => useAnimatedClose(onDone), {
      initialProps: { onDone: first },
    });

    rerender({ onDone: second });

    act(() => {
      result.current.close();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('no ejecuta el cierre si el componente se desmonta antes', () => {
    const onDone = vi.fn();
    const { result, unmount } = renderHook(() => useAnimatedClose(onDone));

    act(() => {
      result.current.close();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDone).not.toHaveBeenCalled();
  });
});
