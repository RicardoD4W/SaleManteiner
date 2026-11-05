import { useEffect } from 'react';

let activeLocks = 0;

export function useScrollLock(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;

    activeLocks += 1;
    root.style.overflow = 'hidden';

    return () => {
      activeLocks -= 1;
      if (activeLocks === 0) root.style.overflow = previousOverflow;
    };
  }, []);
}
