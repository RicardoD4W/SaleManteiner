import { useCallback, useEffect, useRef, useState } from 'react';

export const EXIT_ANIMATION_MS = 150;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export interface AnimatedClose {
  closing: boolean;

  close: (done?: () => void) => void;

  cancel: () => void;
}

export function useAnimatedClose(
  onDone: () => void,
  durationMs = EXIT_ANIMATION_MS,
): AnimatedClose {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setClosing(false);
  }, []);

  const close = useCallback(
    (done?: () => void) => {
      if (timerRef.current !== null) return;
      setClosing(true);
      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          setClosing(false);
          (done ?? onDoneRef.current)();
        },
        prefersReducedMotion() ? 0 : durationMs,
      );
    },
    [durationMs],
  );

  return { closing, close, cancel };
}
