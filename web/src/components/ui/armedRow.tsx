import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { PencilIcon, TrashIcon } from './icons';
import { cn } from '../../lib/classNames';
import type { ArmedTarget } from '../../lib/viewTransition';

export interface ArmedRow {
  id: number;
}

export interface ArmedRowContextValue {
  armedRowId: number | null;

  armedTarget: ArmedTarget | null;

  transitionPrefix: string;

  armRow: (row: ArmedRow, target?: ArmedTarget) => void;
}

export const ArmedRowContext = createContext<ArmedRowContextValue>({
  armedRowId: null,
  armedTarget: null,
  transitionPrefix: '',
  armRow: () => {},
});

export function readArmedRow(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('armedRowId' in state)) return null;
  const value = (state as { armedRowId?: unknown }).armedRowId;
  return typeof value === 'number' ? value : null;
}

export function readArmedTarget(state: unknown): ArmedTarget | null {
  if (typeof state !== 'object' || state === null || !('armedTarget' in state)) return null;
  const value = (state as { armedTarget?: unknown }).armedTarget;
  return value === 'edit' || value === 'receipt' ? value : null;
}

export interface ArmedRowOptions<T extends ArmedRow, D> {
  transitionPrefix: string;

  detailKey: string;

  toDetail: (row: T) => D;

  prime?: (row: T, queryClient: QueryClient) => void;
}

interface ArmedState {
  id: number;

  navigation: string;

  target: ArmedTarget | null;
}

export function useArmedRow<T extends ArmedRow, D>({
  transitionPrefix,
  detailKey,
  toDetail,
  prime,
}: ArmedRowOptions<T, D>) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState<ArmedState | null>(() => {
    const id = readArmedRow(location.state);
    if (id === null) return null;
    return { id, navigation: location.key, target: readArmedTarget(location.state) };
  });

  const rowFromState = readArmedRow(location.state);
  const targetFromState = readArmedTarget(location.state);
  const armedRowId = armed && armed.navigation === location.key ? armed.id : rowFromState;
  const armedTarget = armed && armed.navigation === location.key ? armed.target : targetFromState;

  const armRow = useCallback(
    (row: T, target: ArmedTarget = 'edit') => {
      setArmed({ id: row.id, navigation: location.key, target });
      queryClient.setQueryData<D>([detailKey, row.id], toDetail(row));
      prime?.(row, queryClient);
    },
    [detailKey, location.key, prime, queryClient, toDetail],
  );

  const contextValue = useMemo<ArmedRowContextValue>(
    () => ({
      armedRowId,
      armedTarget,
      transitionPrefix,
      armRow: armRow as ArmedRowContextValue['armRow'],
    }),
    [armedRowId, armedTarget, transitionPrefix, armRow],
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
  targets,
  children,
}: {
  row: ArmedRow;

  field: string;

  className?: string;

  targets?: ArmedTarget[];

  children: ReactNode;
}) {
  const { armedRowId, armedTarget, transitionPrefix } = useContext(ArmedRowContext);
  const armed = row.id === armedRowId;
  const participates = !targets || (armedTarget !== null && targets.includes(armedTarget));
  const name = `${transitionPrefix}-${field}-${row.id}`;
  const baseClass = armedTarget === 'receipt' ? 'vt-box' : 'vt-cell';
  return (
    <span
      className={cn(baseClass, className)}
      style={armed && participates ? { viewTransitionName: name } : undefined}
      data-vt-name={armed && participates ? name : undefined}
    >
      {children}
    </span>
  );
}

export function TravellingField({
  name,
  className,
  children,
}: {
  name: string;

  className?: string;

  children: ReactNode;
}) {
  return (
    <span
      className={cn('vt-box', className)}
      style={{ viewTransitionName: name }}
      data-vt-name={name}
    >
      {children}
    </span>
  );
}

export function RowActions<T extends ArmedRow>({
  row,
  editBasePath,
  editAriaLabel = 'Editar',
  deleteAriaLabel,
  onDelete,
  extraAction,
}: {
  row: T;

  editBasePath: string;

  editAriaLabel?: string;

  deleteAriaLabel: string;

  onDelete: (row: T) => void;

  extraAction?: ReactNode;
}) {
  const { armRow } = useContext(ArmedRowContext);
  return (
    <div className="flex items-center justify-center gap-2">
      <Link
        to={`${editBasePath}/${row.id}`}
        viewTransition
        onMouseEnter={() => armRow(row)}
        onFocus={() => armRow(row)}
        onPointerDown={() => armRow(row)}
        aria-label={editAriaLabel}
        className="cursor-pointer rounded text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-gray-900"
      >
        <PencilIcon />
      </Link>
      {extraAction}
      <button
        type="button"
        onClick={() => onDelete(row)}
        aria-label={deleteAriaLabel}
        className="cursor-pointer rounded text-red-700 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-offset-gray-900"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
