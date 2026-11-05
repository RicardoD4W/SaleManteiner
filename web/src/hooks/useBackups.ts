import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupsApi } from '../api/backups.js';
import { invalidate } from '../lib/queryClient';

const DATA_KEYS = [
  ['backups'],
  ['stats'],
  ['buys'],
  ['solds'],
  ['customers'],
  ['expenses'],
  ['expense-categories'],
] as const;

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => backupsApi.list(),
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => backupsApi.create(),
    onSuccess: () => {
      invalidate(qc, ['backups']);
    },
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => backupsApi.remove(name),
    onSuccess: () => {
      invalidate(qc, ['backups']);
    },
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: { kind: 'stored'; name: string } | { kind: 'file'; file: File }) =>
      source.kind === 'stored'
        ? backupsApi.restoreStored(source.name)
        : backupsApi.restoreFromFile(source.file),
    onSuccess: () => {
      for (const key of DATA_KEYS) invalidate(qc, key);
    },
  });
}
