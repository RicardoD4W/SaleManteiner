import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={[
          'block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          'dark:disabled:bg-gray-900 dark:disabled:text-gray-500',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100 dark:border-gray-700 dark:focus:border-brand-400 dark:focus:ring-brand-900',
          className ?? '',
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
