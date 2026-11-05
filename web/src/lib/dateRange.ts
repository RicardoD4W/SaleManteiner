export interface DateRange {
  from?: string;
  to?: string;
}

export type DateRangePreset = 'all' | 'month' | 'quarter' | 'year';

export type DateRangeSelection = DateRangePreset | 'custom';

export interface DateRangePresetOption {
  id: DateRangePreset;
  label: string;
}

export const DATE_RANGE_PRESETS: DateRangePresetOption[] = [
  { id: 'all', label: 'Todo' },
  { id: 'month', label: 'Este mes' },
  { id: 'quarter', label: 'Último trimestre' },
  { id: 'year', label: 'Este año' },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isIsoDate(value: string | undefined | null): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

export function formatIsoDate(value: string): string {
  if (!isIsoDate(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function presetRange(preset: DateRangePreset, today: Date = new Date()): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();

  if (preset === 'month') {
    return {
      from: toIsoDate(new Date(year, month, 1)),
      to: toIsoDate(new Date(year, month + 1, 0)),
    };
  }

  if (preset === 'quarter') {
    return {
      from: toIsoDate(new Date(year, month - 2, 1)),
      to: toIsoDate(new Date(year, month + 1, 0)),
    };
  }

  if (preset === 'year') {
    return {
      from: toIsoDate(new Date(year, 0, 1)),
      to: toIsoDate(new Date(year, 11, 31)),
    };
  }

  return {};
}

export function isRangeActive(range: DateRange): boolean {
  return Boolean(range.from || range.to);
}

export function isValidRange(range: DateRange): boolean {
  if (!range.from || !range.to) return true;
  return range.from <= range.to;
}

export function rangesEqual(a: DateRange, b: DateRange): boolean {
  return (a.from ?? '') === (b.from ?? '') && (a.to ?? '') === (b.to ?? '');
}

export function findActivePreset(range: DateRange, today: Date = new Date()): DateRangeSelection {
  if (!isRangeActive(range)) return 'all';

  for (const preset of DATE_RANGE_PRESETS) {
    if (preset.id === 'all') continue;
    if (rangesEqual(range, presetRange(preset.id, today))) return preset.id;
  }

  return 'custom';
}

export function describeRange(range: DateRange): string {
  if (range.from && range.to) {
    return `Del ${formatIsoDate(range.from)} al ${formatIsoDate(range.to)}`;
  }
  if (range.from) return `Desde ${formatIsoDate(range.from)}`;
  if (range.to) return `Hasta ${formatIsoDate(range.to)}`;
  return 'Sin filtro de fecha';
}
