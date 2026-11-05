const STORAGE_PREFIX = 'salemanteiner-chart';

function storageKey(chartId: string): string {
  return `${STORAGE_PREFIX}-${chartId}-hidden`;
}

export function readHiddenSeries(chartId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(chartId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function writeHiddenSeries(chartId: string, series: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(chartId), JSON.stringify([...series]));
  } catch {
    return;
  }
}
