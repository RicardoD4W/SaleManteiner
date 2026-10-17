import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={['rounded-lg border border-gray-200 bg-white shadow-sm', className ?? ''].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={['border-b border-gray-200 px-4 py-3 sm:px-6', className ?? ''].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className, ...rest }: CardProps) {
  return (
    <div className={['px-4 py-4 sm:px-6', className ?? ''].join(' ')} {...rest}>
      {children}
    </div>
  );
}
