import { useId, type FormEvent } from 'react';

interface SearchInputProps {
  value: string;

  onChange: (value: string) => void;

  label?: string;

  landmarkLabel?: string;

  resultsText?: string;

  countTestId?: string;

  placeholder?: string;

  id?: string;

  className?: string;
}

export function SearchInput({
  value,
  onChange,
  label = 'Buscar',
  landmarkLabel,
  placeholder = 'Buscar…',
  id,
  resultsText,
  countTestId,
  className,
}: SearchInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      aria-label={landmarkLabel ?? label}
      className={['flex w-full flex-col gap-1', className ?? ''].join(' ')}
    >
      <div className="flex items-baseline justify-between mx-1">
        <label htmlFor={inputId} className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </label>

        <span
          data-testid={countTestId}
          aria-live="polite"
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {resultsText}
        </span>
      </div>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={[
            'block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm text-gray-900',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
            'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400',
            'dark:focus:ring-brand-400 dark:focus:ring-offset-gray-900',
            '[&::-webkit-search-cancel-button]:appearance-none',
          ].join(' ')}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
            className={[
              'absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center',
              'rounded-md text-gray-500 transition-colors',
              'hover:bg-gray-100 hover:text-gray-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              focusable="false"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </form>
  );
}
