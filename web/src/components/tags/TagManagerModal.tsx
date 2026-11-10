import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { ErrorState } from '../ui/ErrorState';
import { PencilIcon, TrashIcon } from '../ui/icons';
import { cn } from '../../lib/classNames';
import { errorAlertClass } from '../ui/tableStyles';
import { apiErrorMessage } from '../../api/client';
import type { ApiTagWithCount } from '../../api/tags';
import { TAG_PALETTE } from '../../lib/tagColors';
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '../../hooks/useTags';
import { useBuys } from '../../hooks/useBuys';
import { TagColorPicker } from './TagColorPicker';
import { DeleteTagCascade } from './DeleteTagCascade';

interface TagManagerModalProps {
  onClose: () => void;
}

function buyCountText(count: number): string {
  if (count === 0) return 'sin compras';
  if (count === 1) return '1 compra';
  return `${count} compras`;
}

function deleteConfirmation(tag: ApiTagWithCount): string {
  return `¿Estás seguro de que quieres borrar el tag «${tag.name}»?`;
}

export function TagManagerModal({ onClose }: TagManagerModalProps) {
  const { data: tags, isLoading, isError, error, refetch } = useTags('buy');
  const createTagMutation = useCreateTag('buy');
  const updateTagMutation = useUpdateTag('buy');
  const deleteTagMutation = useDeleteTag('buy');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(TAG_PALETTE[0]);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>(TAG_PALETTE[0]);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ApiTagWithCount | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'affected'>('confirm');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const tagBuys = useBuys(
    undefined,
    { tagIds: deleteTarget ? [deleteTarget.id] : [] },
    { enabled: deleteTarget !== null },
  );
  const affectedBuys = tagBuys.data ?? [];
  const checkingAffected = deleteTarget !== null && tagBuys.isLoading;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError('El nombre del tag es obligatorio');
      return;
    }
    setCreateError(null);
    try {
      await createTagMutation.mutateAsync({ name, color: newColor });
      setNewName('');
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'No se pudo crear el tag'));
    }
  };

  const handleStartEdit = (tag: ApiTagWithCount) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditError(null);
  };

  const handleSaveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name) {
      setEditError('El nombre del tag es obligatorio');
      return;
    }
    setEditError(null);
    try {
      await updateTagMutation.mutateAsync({ id, input: { name, color: editColor } });
      setEditingId(null);
    } catch (err) {
      setEditError(apiErrorMessage(err, 'No se pudo modificar el tag'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteTagMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteStep('confirm');
    } catch (err) {
      setDeleteError(apiErrorMessage(err, 'No se pudo borrar el tag'));
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || checkingAffected) return;
    setDeleteError(null);
    if (affectedBuys.length > 0) {
      setDeleteStep('affected');
      return;
    }
    void handleDelete();
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
    setDeleteStep('confirm');
    setDeleteError(null);
  };

  return (
    <Modal title="Tags de compra" onClose={onClose} size="medium">
      <div className="space-y-4 p-4">
        {deleteTarget && deleteStep === 'affected' ? (
          <DeleteTagCascade
            tagName={deleteTarget.name}
            buys={affectedBuys}
            isPending={deleteTagMutation.isPending}
            error={deleteError}
            onCancel={handleCancelDelete}
            onConfirm={() => void handleDelete()}
          />
        ) : null}

        {deleteTarget && deleteStep === 'confirm' ? (
          <div className="space-y-2 animate-pop-in rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm text-gray-800 dark:text-gray-100">
              {deleteConfirmation(deleteTarget)}
            </p>
            {checkingAffected ? (
              <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <Spinner size="sm" /> Comprobando si el tag tiene compras…
              </p>
            ) : null}
            {deleteError ? (
              <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
                {deleteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelDelete}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deleteTagMutation.isPending}
                disabled={checkingAffected}
                onClick={handleConfirmDelete}
              >
                Sí, borrar
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Spinner size="sm" /> Cargando tags…
          </div>
        ) : null}

        {isError ? (
          <div className={cn(errorAlertClass, 'p-4')}>
            <ErrorState
              message={`No se pudieron cargar los tags: ${error.message}`}
              onRetry={() => refetch()}
              messageClassName=""
            />
          </div>
        ) : null}

        {!isLoading && !isError && (tags ?? []).length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No hay tags todavía. Crea el primero para poder agrupar compras.
          </p>
        ) : null}

        {(tags ?? []).length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {(tags ?? []).map((tag) => (
              <li key={tag.id} className="flex flex-wrap items-center gap-3 py-3">
                {editingId === tag.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      label={`Nuevo nombre de ${tag.name}`}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                    <TagColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        isLoading={updateTagMutation.isPending}
                        onClick={() => handleSaveEdit(tag.id)}
                      >
                        Guardar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                    {editError ? (
                      <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
                        {editError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-4 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{tag.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {buyCountText(tag.buy_count)}
                    </span>
                    <div className="ml-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tag)}
                        aria-label={`Editar ${tag.name}`}
                        className="cursor-pointer rounded text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(tag);
                          setDeleteStep('confirm');
                          setDeleteError(null);
                        }}
                        aria-label={`Borrar ${tag.name}`}
                        className="cursor-pointer rounded text-red-700 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300 dark:focus-visible:ring-offset-gray-900"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <Input
            label="Nombre del tag"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Urgente, Oferta…"
          />
          <TagColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={createTagMutation.isPending}
              onClick={handleCreate}
            >
              Crear tag
            </Button>
          </div>
          {createError ? (
            <p role="alert" className={cn(errorAlertClass, 'px-3 py-2')}>
              {createError}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
