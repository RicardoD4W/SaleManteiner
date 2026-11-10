import { useState } from 'react';
import { Input } from '../ui/Input';
import { TAG_PALETTE, isAccessibleTagColor, isValidTagColor } from '../../lib/tagColors';
import { cn } from '../../lib/classNames';

interface TagColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

const INVALID_COLOR_MESSAGE = 'El color debe tener formato #rrggbb';

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const invalid = text !== '' && !isValidTagColor(text);
  const lowContrast = isValidTagColor(text) && !isAccessibleTagColor(text);

  const handleTextChange = (next: string) => {
    setText(next);
    if (isValidTagColor(next)) {
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Colores predefinidos" className="flex flex-wrap gap-2">
        {TAG_PALETTE.map((color) => {
          const active = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              aria-pressed={active}
              onClick={() => onChange(color)}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-transform',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                'dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900',
                active
                  ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-brand-400'
                  : 'hover:scale-110',
              )}
            >
              <span
                aria-hidden="true"
                className="size-5 rounded-full ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: color }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Color libre"
          value={text}
          error={invalid ? INVALID_COLOR_MESSAGE : undefined}
          onChange={(event) => handleTextChange(event.target.value)}
          placeholder="#rrggbb"
          className="w-32"
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Selector de color
          </span>
          <input
            type="color"
            aria-label="Selector de color"
            value={isValidTagColor(value) ? value : '#000000'}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-16 cursor-pointer rounded-md border border-gray-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-gray-400 dark:focus-visible:ring-offset-gray-900"
          />
        </div>
      </div>

      {lowContrast ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Este color puede reducir el contraste de la tabla.
        </p>
      ) : null}
    </div>
  );
}
