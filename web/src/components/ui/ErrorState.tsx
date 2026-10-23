import type { ReactNode } from 'react';

interface ErrorStateProps {
  message: ReactNode;
  onRetry: () => void;
  className?: string;
  messageClassName?: string;
}

export function ErrorState({
  message,
  onRetry,
  className,
  messageClassName = 'text-sm text-red-700 dark:text-red-400',
}: ErrorStateProps) {
  return (
    <div className={className}>
      <p className={messageClassName}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Reintentar
      </button>
    </div>
  );
}
