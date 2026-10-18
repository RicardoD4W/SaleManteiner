import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useDeleteSale } from '../../hooks/useDeleteSale';

interface DeleteSaleButtonProps {
  id: number;
  productName: string;
}

export function DeleteSaleButton({ id, productName }: DeleteSaleButtonProps) {
  const navigate = useNavigate();
  const remove = useDeleteSale();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    try {
      await remove.mutateAsync(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Eliminar
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
      <p className="text-sm text-red-800 dark:text-red-300">
        ¿Eliminar <strong>"{productName}"</strong>? Esta acción no se puede deshacer.
      </p>
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button variant="danger" size="sm" isLoading={remove.isPending} onClick={handleDelete}>
          Sí, eliminar
        </Button>
      </div>
    </div>
  );
}
