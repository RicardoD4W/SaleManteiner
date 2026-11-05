import { useId, useMemo, useState, type CSSProperties } from 'react';
import { useProductNames } from '../../hooks/useProductNames';
import { normalizeText } from '../../lib/searchQuery.js';
import { Spinner } from '../ui/Spinner';
import { inputClassName } from '../ui/inputStyles.js';

const MAX_SUGGESTIONS = 8;

interface ProductNameAutocompleteProps {
  value: string;

  onChange: (value: string) => void;

  onBlur?: () => void;

  label?: string;

  error?: string;

  placeholder?: string;

  className?: string;

  autoFocus?: boolean;

  style?: CSSProperties;
}

export function ProductNameAutocomplete({
  value,
  onChange,
  onBlur,
  label = 'Producto *',
  error,
  placeholder = 'Funda iPhone 15',
  className,
  autoFocus,
  style,
}: ProductNameAutocompleteProps) {
  const { data: products, isLoading } = useProductNames();

  const [isOpen, setIsOpen] = useState(false);

  const [activeIndex, setActiveIndex] = useState(-1);

  const listboxId = useId();

  const inputId = `${listboxId}-input`;

  const currentValue = value ?? '';

  const query = normalizeText(currentValue.trim());

  const matches = useMemo(() => {
    if (!query) return [];
    return (products ?? [])
      .filter((product) => normalizeText(product.name).includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [products, query]);

  const showList = isOpen && matches.length > 0;

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!matches.length) return;
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!matches.length) return;
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && showList && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(matches[activeIndex].name);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeDescendant =
    showList && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const showNoMatches = isOpen && query.length > 0 && !isLoading && matches.length === 0;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${listboxId}-error` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={currentValue}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setIsOpen(false);
            setActiveIndex(-1);
            onBlur?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName(error, ['pr-10', className ?? ''].join(' '))}
          style={style}
        />

        {isLoading ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        ) : null}
      </div>

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Productos"
          onMouseDown={(e) => e.preventDefault()}
          className={[
            'absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-lg border',
            'bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800',
            'divide-y divide-gray-100 dark:divide-gray-700',
          ].join(' ')}
        >
          {matches.map((product, idx) => (
            <li
              key={product.name}
              id={`${listboxId}-option-${idx}`}
              role="option"
              aria-selected={product.name === currentValue}
              onClick={() => handleSelect(product.name)}
              className={[
                'cursor-pointer px-3 py-2 text-sm',
                activeIndex === idx
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span>{product.name}</span>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {product.uses} {product.uses === 1 ? 'uso' : 'usos'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {showNoMatches ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Ningún producto coincide con ese nombre: se guardará tal cual.
        </p>
      ) : null}

      {error ? (
        <p
          id={`${listboxId}-error`}
          className="text-sm text-red-700 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
