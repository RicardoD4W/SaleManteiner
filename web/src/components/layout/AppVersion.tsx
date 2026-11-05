import { useState } from 'react';
import { BackupModal } from './BackupModal';

export function AppVersion() {
  const app = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const front = import.meta.env.VITE_FRONT_VERSION ?? 'dev';
  const back = import.meta.env.VITE_BACK_VERSION ?? 'dev';
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-2 text-center text-xs text-gray-500 print:hidden dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span>
          AFB: {app} - {front} - {back}
        </span>
        <button
          type="button"
          onClick={() => setIsBackupOpen(true)}
          className="rounded-md px-2 py-1 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          Copia de seguridad
        </button>
      </div>
      {isBackupOpen ? <BackupModal onClose={() => setIsBackupOpen(false)} /> : null}
    </footer>
  );
}
