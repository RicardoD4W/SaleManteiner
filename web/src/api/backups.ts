import { ApiError, apiFetch } from './client.js';

export interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

export interface RestoreSummary {
  customers: number;
  buys: number;
  solds: number;
  sale_items: number;
  expenses: number;
  expense_categories: number;
  safety_backup: string;
}

interface ListResponse {
  data: BackupFile[];
}

interface ItemResponse {
  data: BackupFile;
}

interface RestoreResponse {
  data: RestoreSummary;
}

async function postBinary(path: string, file: File): Promise<RestoreSummary> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': file.name },
      body: file,
    });
  } catch {
    throw new ApiError(0, { error: 'Error de red' });
  }

  if (!res.ok) {
    const errorBody = await res
      .json()
      .catch(() => ({ error: res.statusText || 'Error desconocido' }));
    throw new ApiError(res.status, errorBody);
  }

  const body = (await res.json()) as RestoreResponse;
  return body.data;
}

export const backupsApi = {
  list: () => apiFetch<ListResponse>('/api/backups').then((r) => r.data),

  create: () => apiFetch<ItemResponse>('/api/backups', { method: 'POST' }).then((r) => r.data),

  remove: (name: string) =>
    apiFetch<void>(`/api/backups/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  restoreStored: (name: string) =>
    apiFetch<RestoreResponse>(`/api/backups/${encodeURIComponent(name)}/restore`, {
      method: 'POST',
    }).then((r) => r.data),

  restoreFromFile: (file: File) => postBinary('/api/backups/restore', file),

  downloadUrl: (name: string) => `/api/backups/${encodeURIComponent(name)}/download`,
};
