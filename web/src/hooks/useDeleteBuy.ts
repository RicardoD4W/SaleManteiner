import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buysApi } from '../api/buys.js';
import { ApiError } from '../api/client';
import { toastDeleted } from '../lib/toast.js';
import type { AssociatedSale } from '../api/types';
import { invalidate } from '../lib/queryClient';

type DeleteBuy409Body = {
  error: string;
  associated_sales: AssociatedSale[];
};

export function isDeleteBuy409(err: unknown): err is ApiError & { body: DeleteBuy409Body } {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const body = err.body as Partial<DeleteBuy409Body>;
  return Array.isArray(body.associated_sales) && body.associated_sales.length > 0;
}

export function useDeleteBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => buysApi.remove(id),
    onSuccess: () => {
      toastDeleted('buy');
      invalidate(qc, ['buys'], ['stats', 'dashboard']);
    },
  });
}
