import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_MS, prefersReducedMotion } from '../lib/motion';

export const EXIT_ANIMATION_MS = MOTION_MS;

export interface AnimatedClose {
  closing: boolean;

  close: () => void;

  closeWith: (done: () => void) => void;

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

  const closeWith = useCallback(
    (done: () => void) => {
      if (timerRef.current !== null) return;
      setClosing(true);
      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          setClosing(false);
          done();
        },
        prefersReducedMotion() ? 0 : durationMs,
      );
    },
    [durationMs],
  );

  const close = useCallback(() => {
    if (timerRef.current !== null) return;
    closeWith(() => onDoneRef.current());
  }, [closeWith]);

  return { closing, close, closeWith, cancel };
}
