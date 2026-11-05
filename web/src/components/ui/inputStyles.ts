const BASE_CLASSES = [
  'block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-offset-0',
  'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400',
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
  'dark:disabled:bg-gray-900 dark:disabled:text-gray-500',
];

const ERROR_CLASSES =
  'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800';

const NORMAL_CLASSES =
  'border-gray-300 focus:border-brand-500 focus:ring-brand-100 dark:border-gray-700 dark:focus:border-brand-400 dark:focus:ring-brand-900';

export function inputClassName(error?: string, extra?: string): string {
  return [...BASE_CLASSES, error ? ERROR_CLASSES : NORMAL_CLASSES, extra ?? ''].join(' ');
}
