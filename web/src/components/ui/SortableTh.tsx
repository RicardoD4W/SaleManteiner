import type { CSSProperties, ReactNode } from 'react';
import type { SortState } from '../../lib/sorting';

interface SortableThProps {
  label: ReactNode;

  /** 'asc' | 'desc' si la columna está ordenada, false si no. */
  sorted: SortState;

  onSort: () => void;

  className?: string;

  style?: CSSProperties;

  labelClassName?: string;
}

/**
 * La cabecera ordenable de todas las tablas: el clic, el teclado (Tab + Enter o
 * espacio), el `aria-sort` y el indicador van en un solo lado, así que todas las
 * pantallas ordenan igual (y todas se pueden usar con el teclado).
 */
export function SortableTh({
  label,
  sorted,
  onSort,
  className,
  style,
  labelClassName = 'min-w-0 truncate',
}: SortableThProps) {
  return (
    <th
      scope="col"
      onClick={onSort}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSort();
        }
      }}
      tabIndex={0}
      className={className}
      style={style}
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
    >
      <span className="flex items-center gap-1">
        <span className={labelClassName}>{label}</span>
        <span className="inline-block w-3 shrink-0 text-center" aria-hidden="true">
          {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
        </span>
      </span>
    </th>
  );
}
