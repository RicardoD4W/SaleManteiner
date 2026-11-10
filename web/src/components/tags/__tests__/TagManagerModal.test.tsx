import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(),
  useCreateTag: vi.fn(),
  useUpdateTag: vi.fn(),
  useDeleteTag: vi.fn(),
}));

import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/hooks/useTags';
import { TagManagerModal } from '@/components/tags/TagManagerModal';
import { renderWithProviders } from '@/test-utils/render';
import { ApiError } from '@/api/client';

const tagsFixture = [
  {
    id: 1,
    scope: 'buy' as const,
    name: 'Urgente',
    color: '#dc2626',
    created_at: '2026-11-01T10:00:00.000Z',
    buy_count: 3,
  },
  {
    id: 2,
    scope: 'buy' as const,
    name: 'Oferta',
    color: '#16a34a',
    created_at: '2026-11-02T10:00:00.000Z',
    buy_count: 0,
  },
];

function mutationMock(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
    ...overrides,
  };
}

describe('TagManagerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTags).mockReturnValue({
      data: tagsFixture,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateTag).mockReturnValue(mutationMock() as never);
    vi.mocked(useUpdateTag).mockReturnValue(mutationMock() as never);
    vi.mocked(useDeleteTag).mockReturnValue(mutationMock() as never);
  });

  it('lista los tags con el número de compras en palabras', () => {
    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    expect(screen.getByText('3 compras')).toBeInTheDocument();
    expect(screen.getByText('sin compras')).toBeInTheDocument();
  });

  it('un nombre vacío avisa y no llama a la API', async () => {
    const user = userEvent.setup();
    const create = mutationMock();
    vi.mocked(useCreateTag).mockReturnValue(create as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Crear tag' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El nombre del tag es obligatorio');
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('crea el tag con el nombre recortado y el color elegido', async () => {
    const user = userEvent.setup();
    const create = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce({ id: 3 }) });
    vi.mocked(useCreateTag).mockReturnValue(create as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre del tag'), '  Oferta  ');
    await user.click(screen.getByRole('button', { name: 'Color #16a34a' }));
    await user.click(screen.getByRole('button', { name: 'Crear tag' }));

    await waitFor(() => {
      expect(create.mutateAsync).toHaveBeenCalledWith({ name: 'Oferta', color: '#16a34a' });
    });
  });

  it('un nombre duplicado muestra el mensaje del servidor', async () => {
    const user = userEvent.setup();
    const create = mutationMock({
      mutateAsync: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(409, { error: 'Ya existe un tag con ese nombre' })),
    });
    vi.mocked(useCreateTag).mockReturnValue(create as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre del tag'), 'Urgente');
    await user.click(screen.getByRole('button', { name: 'Crear tag' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un tag con ese nombre');
  });

  it('al renombrar guarda el nombre y el color', async () => {
    const user = userEvent.setup();
    const update = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce({ id: 1 }) });
    vi.mocked(useUpdateTag).mockReturnValue(update as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar Urgente' }));
    await user.clear(screen.getByLabelText('Nuevo nombre de Urgente'));
    await user.type(screen.getByLabelText('Nuevo nombre de Urgente'), 'Prioritario');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: 1,
        input: { name: 'Prioritario', color: '#dc2626' },
      });
    });
  });

  it('un nombre duplicado al renombrar mantiene la edición abierta', async () => {
    const user = userEvent.setup();
    const update = mutationMock({
      mutateAsync: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(409, { error: 'Ya existe un tag con ese nombre' })),
    });
    vi.mocked(useUpdateTag).mockReturnValue(update as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Editar Urgente' }));
    await user.clear(screen.getByLabelText('Nuevo nombre de Urgente'));
    await user.type(screen.getByLabelText('Nuevo nombre de Urgente'), 'Oferta');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un tag con ese nombre');
    expect(screen.getByLabelText('Nuevo nombre de Urgente')).toBeInTheDocument();
  });

  it('al borrar pide confirmación y dice cuántas compras quedan sin etiqueta', async () => {
    const user = userEvent.setup();
    const remove = mutationMock();
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    expect(screen.getByText(/3 compras quedarán sin etiqueta/)).toBeInTheDocument();
    expect(screen.getByText(/Las compras no se borran/)).toBeInTheDocument();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('confirmar el borrado llama a la mutación de borrar', async () => {
    const user = userEvent.setup();
    const remove = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce(undefined) });
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    await waitFor(() => {
      expect(remove.mutateAsync).toHaveBeenCalledWith(1);
    });
  });

  it('cancelar el borrado no borra el tag', async () => {
    const user = userEvent.setup();
    const remove = mutationMock();
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(remove.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Borrar Urgente' })).toBeInTheDocument();
  });

  it('un tag sin compras se confirma sin mencionar compras afectadas', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Oferta' }));

    expect(screen.getByText(/No hay compras con este tag/)).toBeInTheDocument();
    expect(screen.queryByText(/quedarán sin etiqueta/)).toBeNull();
  });
});
