import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(),
  useCreateTag: vi.fn(),
  useUpdateTag: vi.fn(),
  useDeleteTag: vi.fn(),
}));

vi.mock('@/hooks/useBuys', () => ({
  useBuys: vi.fn(),
}));

import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/hooks/useTags';
import { useBuys } from '@/hooks/useBuys';
import { TagManagerModal } from '@/components/tags/TagManagerModal';
import { renderWithProviders } from '@/test-utils/render';
import { ApiError } from '@/api/client';
import type { BuyWithStock } from '@/api/buys';

function buyFixture(overrides: Partial<BuyWithStock> = {}): BuyWithStock {
  return {
    id: 10,
    product_name: 'Funda etiquetada',
    purchase_cost: 5,
    quantity: 3,
    total_cost: 15,
    associated_costs: 0,
    purchase_date: '2026-11-01',
    notes: null,
    tag: { id: 1, name: 'Urgente', color: '#dc2626' },
    created_at: '2026-11-01T10:00:00.000Z',
    disponibles: 3,
    ...overrides,
  };
}

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
  {
    id: 3,
    scope: 'buy' as const,
    name: 'Contable',
    color: '#0d9488',
    created_at: '2026-11-03T10:00:00.000Z',
    buy_count: 0,
  },
];

const buysByTagId: Record<number, BuyWithStock[]> = {
  1: [
    buyFixture(),
    buyFixture({ id: 11, product_name: 'Funda urgente' }),
    buyFixture({ id: 12, product_name: 'Caja urgente' }),
  ],
  3: [buyFixture({ id: 20, product_name: 'Caja con contador obsoleto' })],
};

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
    vi.mocked(useBuys).mockImplementation((_range, filter) => {
      const ids = filter?.tagIds ?? [];
      const data = ids.flatMap((id) => buysByTagId[id] ?? []);
      return {
        data,
        isLoading: false,
        isError: false,
        error: null,
      } as never;
    });
  });

  it('lista los tags con el número de compras en palabras', () => {
    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    expect(screen.getByText('3 compras')).toBeInTheDocument();
    expect(screen.getAllByText('sin compras')).toHaveLength(2);
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

  it('al borrar pide confirmación con la pregunta genérica', async () => {
    const user = userEvent.setup();
    const remove = mutationMock();
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    expect(
      screen.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quedarán sin etiqueta/)).toBeNull();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('la confirmación de borrado entra con una animación de entrada', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    const confirmation = screen.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
    expect(confirmation.closest('div')).toHaveClass('animate-pop-in');
  });

  it('la confirmación de borrado sale con una animación de salida y luego desaparece', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    const confirmation = screen.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(confirmation.closest('div')).toHaveClass('animate-pop-out');
    expect(confirmation.closest('div')).not.toHaveClass('animate-pop-in');

    await waitFor(() => {
      expect(
        screen.queryByText('¿Estás seguro de que quieres borrar el tag «Urgente»?'),
      ).toBeNull();
    });
  });

  it('la primera confirmación sale con animación antes de aparecer el aviso de compras', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    const confirmation = screen.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    expect(confirmation.closest('div')).toHaveClass('animate-pop-out');
    expect(await screen.findByText(/El tag/)).toBeInTheDocument();
  });

  it('el aviso de compras afectadas sale con una animación de salida al cancelar', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    const cascade = await screen.findByText(/El tag/);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(cascade.closest('div')).toHaveClass('animate-pop-out');

    await waitFor(() => {
      expect(screen.queryByText(/El tag/)).toBeNull();
    });
  });

  it('la confirmación de borrado sale arriba de la lista de tags', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));

    const confirmation = screen.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
    const tagRow = screen.getByText('Urgente', { selector: 'span' });
    expect(
      confirmation.compareDocumentPosition(tagRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('un tag con compras abre el segundo aviso con los productos que lo tienen', async () => {
    const user = userEvent.setup();
    const remove = mutationMock();
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    expect(await screen.findByText('Funda etiquetada')).toBeInTheDocument();
    expect(screen.getByText('Caja urgente')).toBeInTheDocument();
    expect(screen.getByText(/tiene/)).toHaveTextContent('3 compras');
    expect(screen.getByText(/Las compras no se borran/)).toBeInTheDocument();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('confirmar el segundo aviso borra el tag', async () => {
    const user = userEvent.setup();
    const remove = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce(undefined) });
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Urgente' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await user.click(await screen.findByRole('button', { name: 'Sí, borrar el tag' }));

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

  it('el aviso sale aunque el contador del catálogo esté obsoleto', async () => {
    const user = userEvent.setup();
    const remove = mutationMock();
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Contable' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    expect(await screen.findByText('Caja con contador obsoleto')).toBeInTheDocument();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('un tag sin compras se borra tras la confirmación, sin segundo aviso', async () => {
    const user = userEvent.setup();
    const remove = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce(undefined) });
    vi.mocked(useDeleteTag).mockReturnValue(remove as never);

    renderWithProviders(<TagManagerModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Oferta' }));
    expect(
      screen.getByText('¿Estás seguro de que quieres borrar el tag «Oferta»?'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    await waitFor(() => {
      expect(remove.mutateAsync).toHaveBeenCalledWith(2);
    });
    expect(screen.queryByRole('button', { name: 'Sí, borrar el tag' })).toBeNull();
  });
});
