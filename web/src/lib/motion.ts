export const MOTION_MS = 200;

export const TABLE_MOTION_MS = 240;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
