import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useBackups', () => ({
  useBackups: vi.fn(),
  useCreateBackup: vi.fn(),
  useDeleteBackup: vi.fn(),
  useRestoreBackup: vi.fn(),
}));

vi.mock('sileo', () => ({
  sileo: { success: vi.fn() },
}));

import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup } from '@/hooks/useBackups';
import { BackupModal } from '@/components/layout/BackupModal';
import { renderWithProviders } from '@/test-utils/render';

const backups = [
  { name: 'salemanteiner-20261104-101500.db', size: 2048, created_at: '2026-11-04T10:15:00.000Z' },
  {
    name: 'pre-restauracion-20261104-090000.db',
    size: 1024,
    created_at: '2026-11-04T09:00:00.000Z',
  },
];

function mockBackups(data: unknown) {
  vi.mocked(useBackups).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

function mockMutations() {
  const create = { mutateAsync: vi.fn().mockResolvedValue({ name: 'nueva.db', size: 10 }) };
  const remove = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
  const restore = { mutateAsync: vi.fn().mockResolvedValue({ customers: 1 }), isPending: false };

  vi.mocked(useCreateBackup).mockReturnValue({
    mutateAsync: create.mutateAsync,
    isPending: false,
  } as never);
  vi.mocked(useDeleteBackup).mockReturnValue(remove as never);
  vi.mocked(useRestoreBackup).mockReturnValue(restore as never);

  return { create, remove, restore };
}

describe('BackupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBackups(backups);
  });

  it('lista las copias guardadas con su fecha y su tamaño', () => {
    mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    expect(screen.getByTestId('backup-list')).toBeInTheDocument();
    expect(screen.getByText('salemanteiner-20261104-101500.db')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it('avisa cuando no hay copias', () => {
    mockBackups([]);
    mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    expect(screen.getByText('Todavía no hay copias guardadas.')).toBeInTheDocument();
  });

  it('crea una copia nueva', async () => {
    const { create } = mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('backup-create'));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledTimes(1));
  });

  it('pide confirmación antes de restaurar una copia guardada', async () => {
    const { restore } = mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByText('Restaurar')[0]);

    expect(screen.getByText('Restaurar la copia')).toBeInTheDocument();
    expect(restore.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Sí, restaurar'));

    await waitFor(() =>
      expect(restore.mutateAsync).toHaveBeenCalledWith({
        kind: 'stored',
        name: 'salemanteiner-20261104-101500.db',
      }),
    );
  });

  it('pide confirmación antes de restaurar un archivo subido', async () => {
    const { restore } = mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    const file = new File(['contenido'], 'copia-descargada.db', {
      type: 'application/octet-stream',
    });
    fireEvent.change(screen.getByTestId('backup-file-input'), { target: { files: [file] } });

    expect(screen.getByText('copia-descargada.db')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sí, restaurar'));

    await waitFor(() => expect(restore.mutateAsync).toHaveBeenCalledWith({ kind: 'file', file }));
  });

  it('pide confirmación antes de eliminar una copia', async () => {
    const { remove } = mockMutations();

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByText('Eliminar')[0]);

    expect(screen.getByText('Eliminar la copia')).toBeInTheDocument();
    expect(remove.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Sí, eliminar'));

    await waitFor(() =>
      expect(remove.mutateAsync).toHaveBeenCalledWith('salemanteiner-20261104-101500.db'),
    );
  });

  it('muestra el error si la restauración falla', async () => {
    const { restore } = mockMutations();
    restore.mutateAsync.mockRejectedValue(new Error('El archivo está dañado'));

    renderWithProviders(<BackupModal onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByText('Restaurar')[0]);
    fireEvent.click(screen.getByText('Sí, restaurar'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('El archivo está dañado'),
    );
  });
});
