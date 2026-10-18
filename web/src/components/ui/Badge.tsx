import type { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  success: 'bg-green-100 text-green-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className ?? '',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
