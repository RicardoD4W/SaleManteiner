import { useId, useState } from 'react';
import { Input } from './Input.js';
import {
  DATE_RANGE_PRESETS,
  describeRange,
  findActivePreset,
  isRangeActive,
  isValidRange,
  presetRange,
  rangesEqual,
  type DateRange,
  type DateRangeSelection,
} from '../../lib/dateRange.js';

type DateRangeFilterLayout = 'default' | 'stacked';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  today?: Date;
  label?: string;
  fromLabel?: string;
  toLabel?: string;
  clearLabel?: string;
  className?: string;
  layout?: DateRangeFilterLayout;
}

const INVALID_RANGE_MESSAGE = 'La fecha inicial no puede ser posterior a la final';

const PRESET_BUTTON_CLASSES = [
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
  'focus-visible:ring-offset-2 dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900',
].join(' ');

const PRESET_ACTIVE_CLASSES = 'bg-brand-600 text-white hover:bg-brand-700';

const PRESET_IDLE_CLASSES = [
  'bg-white text-gray-700 hover:bg-gray-100',
  'dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
].join(' ');

export function DateRangeFilter({
  value,
  onChange,
  today = new Date(),
  label = 'Período',
  fromLabel = 'Desde',
  toLabel = 'Hasta',
  clearLabel = 'Quitar filtro',
  className,
  layout = 'default',
}: DateRangeFilterProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const [draft, setDraft] = useState<DateRange>(value);
  const [lastValue, setLastValue] = useState<DateRange>(value);

  if (!rangesEqual(value, lastValue)) {
    setLastValue(value);
    setDraft(value);
  }

  const activePreset: DateRangeSelection = findActivePreset(value, today);
  const invalid = !isValidRange(draft);
  const error = invalid ? INVALID_RANGE_MESSAGE : undefined;

  const applyRange = (next: DateRange) => {
    setDraft(next);
    if (!isValidRange(next)) return;
    onChange(next);
  };

  const handleFromChange = (from: string) => {
    applyRange({ from: from || undefined, to: draft.to });
  };

  const handleToChange = (to: string) => {
    applyRange({ from: draft.from, to: to || undefined });
  };

  const handlePreset = (preset: (typeof DATE_RANGE_PRESETS)[number]['id']) => {
    applyRange(presetRange(preset, today));
  };

  const handleClear = () => {
    if (!isRangeActive(value) && !isRangeActive(draft)) return;
    applyRange({});
  };

  return (
    <fieldset
      className={['flex flex-col gap-2 mt-2', className ?? ''].join(' ')}
      aria-label={label}
    >
      <div
        className={
          layout === 'stacked'
            ? 'flex flex-col gap-3'
            : 'flex flex-wrap items-end justify-between gap-3'
        }
      >
        <div className="flex flex-wrap items-center gap-1">
          {DATE_RANGE_PRESETS.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => handlePreset(preset.id)}
                className={[
                  PRESET_BUTTON_CLASSES,
                  active ? PRESET_ACTIVE_CLASSES : PRESET_IDLE_CLASSES,
                ].join(' ')}
              >
                {preset.label}
              </button>
            );
          })}
          <p className="ml-1 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
            {describeRange(value)}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {fromLabel}:
          <Input
            id={`${groupId}-from`}
            type="date"
            value={draft.from ?? ''}
            aria-label={fromLabel}
            aria-invalid={invalid || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => handleFromChange(event.target.value)}
            className="w-40"
          />
          {toLabel}:
          <Input
            id={`${groupId}-to`}
            type="date"
            value={draft.to ?? ''}
            aria-label={toLabel}
            aria-invalid={invalid || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => handleToChange(event.target.value)}
            className="w-40"
          />
          <button
            type="button"
            onClick={handleClear}
            className={[
              'rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-offset-gray-900',
            ].join(' ')}
          >
            {clearLabel}
          </button>
        </div>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
