import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export interface ArmedRow {
  id: number;
}

export interface ArmedRowContextValue {
  armedRowId: number | null;

  transitionPrefix: string;

  armRow: (row: ArmedRow) => void;
}

const ArmedRowContext = createContext<ArmedRowContextValue>({
  armedRowId: null,
  transitionPrefix: '',
  armRow: () => {},
});

export function readArmedRow(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('armedRowId' in state)) return null;
  const value = (state as { armedRowId?: unknown }).armedRowId;
  return typeof value === 'number' ? value : null;
}

export interface ArmedRowOptions<T extends ArmedRow, D> {
  transitionPrefix: string;

  detailKey: string;

  toDetail: (row: T) => D;
}

export function useArmedRow<T extends ArmedRow, D>({
  transitionPrefix,
  detailKey,
  toDetail,
}: ArmedRowOptions<T, D>) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState<{ id: number; navigation: string } | null>(null);

  const rowFromState = readArmedRow(location.state);
  const armedRowId = armed && armed.navigation === location.key ? armed.id : rowFromState;

  const armRow = useCallback(
    (row: T) => {
      setArmed({ id: row.id, navigation: location.key });
      queryClient.setQueryData<D>([detailKey, row.id], toDetail(row));
    },
    [detailKey, location.key, queryClient, toDetail],
  );

  const contextValue = useMemo<ArmedRowContextValue>(
    () => ({
      armedRowId,
      transitionPrefix,
      armRow: armRow as ArmedRowContextValue['armRow'],
    }),
    [armedRowId, armRow, transitionPrefix],
  );

  return { armedRowId, contextValue };
}

export function ArmedRowProvider({
  value,
  children,
}: {
  value: ArmedRowContextValue;
  children: ReactNode;
}) {
  return <ArmedRowContext.Provider value={value}>{children}</ArmedRowContext.Provider>;
}

export function TravellingCell({
  row,
  field,
  className,
  children,
}: {
  row: ArmedRow;

  field: string;

  className?: string;
  children: ReactNode;
}) {
  const { armedRowId, transitionPrefix } = useContext(ArmedRowContext);
  const armed = row.id === armedRowId;
  const name = `${transitionPrefix}-${field}-${row.id}`;
  return (
    <span
      className={['vt-cell', className ?? ''].join(' ')}
      style={armed ? { viewTransitionName: name } : undefined}
      data-vt-name={armed ? name : undefined}
    >
      {children}
    </span>
  );
}

export function RowActions<T extends ArmedRow>({
  row,
  editBasePath,
  deleteAriaLabel,
  onDelete,
}: {
  row: T;

  editBasePath: string;

  deleteAriaLabel: string;

  onDelete: (row: T) => void;
}) {
  const { armRow } = useContext(ArmedRowContext);
  return (
    <div className="flex items-center gap-3">
      <Link
        to={`${editBasePath}/${row.id}`}
        viewTransition
        onMouseEnter={() => armRow(row)}
        onFocus={() => armRow(row)}
        onPointerDown={() => armRow(row)}
        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={() => onDelete(row)}
        aria-label={deleteAriaLabel}
        className="cursor-pointer text-sm font-medium text-red-700 hover:underline dark:text-red-400"
      >
        Borrar
      </button>
    </div>
  );
}
