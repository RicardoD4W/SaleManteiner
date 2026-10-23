export const tableHeadClass =
  'select-none px-4 py-2 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';

export const errorAlertClass =
  'rounded-md border border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400';

export function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-100 text-brand-800 dark:bg-brand-400/40 dark:text-brand-100'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
  ].join(' ');
}
