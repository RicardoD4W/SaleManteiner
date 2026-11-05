import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { ErrorState } from '../ui/ErrorState';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '../../hooks/useBackups';
import { apiErrorMessage } from '../../api/client';
import { backupsApi } from '../../api/backups';
import { formatDate } from '../../lib/format';
import { toastBackupCreated, toastBackupDeleted, toastBackupRestored } from '../../lib/toast';

type RestoreSource = { kind: 'stored'; name: string } | { kind: 'file'; file: File };

interface BackupModalProps {
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupModal({ onClose }: BackupModalProps) {
  const { data, isLoading, isError, error, refetch } = useBackups();
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const restoreBackup = useRestoreBackup();

  const [pendingRestore, setPendingRestore] = useState<RestoreSource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreDescriptionId = useId();

  const handleCreate = async () => {
    setActionError(null);
    try {
      const backup = await createBackup.mutateAsync();
      toastBackupCreated(`Copia creada (${formatSize(backup.size)})`);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'No se pudo crear la copia'));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteBackup.mutateAsync(pendingDelete);
      toastBackupDeleted();
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(apiErrorMessage(err, 'No se pudo eliminar la copia'));
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    setRestoreError(null);
    try {
      const summary = await restoreBackup.mutateAsync(pendingRestore);
      toastBackupRestored(
        `${summary.customers} clientes, ${summary.solds} ventas y ${summary.buys} compras restaurados`,
      );
      setPendingRestore(null);
      onClose();
    } catch (err) {
      setRestoreError(apiErrorMessage(err, 'No se pudo restaurar la copia'));
    }
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestoreError(null);
    setPendingRestore({ kind: 'file', file });
  };

  const backups = data ?? [];

  return (
    <>
      <Modal title="Copia de seguridad" onClose={onClose} size="wide">
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Las copias se guardan junto a la base de datos y se pueden descargar a tu disco. Al
            restaurar, la app guarda antes una copia del estado actual por si acaso.
          </p>

          {actionError ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {actionError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-12">
            <Button
              type="button"
              isLoading={createBackup.isPending}
              onClick={handleCreate}
              data-testid="backup-create"
            >
              Crear copia
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              data-testid="backup-restore-file"
            >
              Restaurar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,application/octet-stream"
              className="hidden"
              onChange={handleFileSelected}
              data-testid="backup-file-input"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <Spinner size="sm" /> Cargando copias…
            </div>
          ) : isError ? (
            <ErrorState
              message={`No se pudieron cargar las copias: ${error.message}`}
              onRetry={() => refetch()}
            />
          ) : backups.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay copias guardadas.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800" data-testid="backup-list">
              {backups.map((backup) => (
                <li
                  key={backup.name}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                      {backup.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(backup.created_at)} · {formatSize(backup.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a
                      href={backupsApi.downloadUrl(backup.name)}
                      download={backup.name}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Descargar
                    </a>
                    <button
                      type="button"
                      onClick={() => setPendingRestore({ kind: 'stored', name: backup.name })}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Restaurar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(backup.name)}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {pendingRestore ? (
        <Modal
          title="Restaurar la copia"
          onClose={() => setPendingRestore(null)}
          size="medium"
          isPending={restoreBackup.isPending}
          describedById={restoreDescriptionId}
        >
          <div className="space-y-4 p-4">
            <div id={restoreDescriptionId} className="text-sm text-gray-700 dark:text-gray-300">
              <p>
                Se va a <strong>reemplazar</strong> la base de datos actual con la copia{' '}
                <strong>
                  {pendingRestore.kind === 'stored'
                    ? pendingRestore.name
                    : pendingRestore.file.name}
                </strong>
                .
              </p>
              <p className="mt-2">
                Antes de hacerlo, la app guarda una copia del estado actual, así que podrás volver
                atrás si te arrepientes.
              </p>
            </div>

            {restoreError ? (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {restoreError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingRestore(null)}
                disabled={restoreBackup.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={restoreBackup.isPending}
                onClick={handleRestore}
              >
                Sí, restaurar
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <Modal
          title="Eliminar la copia"
          onClose={() => setPendingDelete(null)}
          size="medium"
          isPending={deleteBackup.isPending}
        >
          <div className="space-y-4 p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              ¿Eliminar <strong>{pendingDelete}</strong>? La copia se borra del disco y no se puede
              recuperar.
            </p>

            {deleteError ? (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {deleteError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingDelete(null)}
                disabled={deleteBackup.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={deleteBackup.isPending}
                onClick={handleDelete}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
