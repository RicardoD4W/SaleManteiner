export function AppVersion() {
  const app = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const front = import.meta.env.VITE_FRONT_VERSION ?? 'dev';
  const back = import.meta.env.VITE_BACK_VERSION ?? 'dev';

  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-2 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      SaleManteiner {app} · front {front} · back {back}
    </footer>
  );
}
