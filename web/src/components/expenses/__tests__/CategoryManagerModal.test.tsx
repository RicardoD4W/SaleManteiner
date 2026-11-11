import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useExpenseCategories', () => ({
  useExpenseCategories: vi.fn(),
  useCreateExpenseCategory: vi.fn(),
  useUpdateExpenseCategory: vi.fn(),
  useDeleteExpenseCategory: vi.fn(),
}));

import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '@/hooks/useExpenseCategories';
import { CategoryManagerModal } from '@/components/expenses/CategoryManagerModal';
import { renderWithProviders } from '@/test-utils/render';

const categoriesFixture = [
  { id: 1, name: 'Alquiler', expenses_count: 2, total: 900 },
  { id: 2, name: 'Suministros', expenses_count: 0, total: 0 },
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

describe('CategoryManagerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExpenseCategories).mockReturnValue({
      data: categoriesFixture,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateExpenseCategory).mockReturnValue(mutationMock() as never);
    vi.mocked(useUpdateExpenseCategory).mockReturnValue(mutationMock() as never);
    vi.mocked(useDeleteExpenseCategory).mockReturnValue(mutationMock() as never);
  });

  it('el aviso de borrado entra con una animación de entrada', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CategoryManagerModal onClose={vi.fn()} onCascadeRequired={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Alquiler' }));

    expect(screen.getByText(/¿Eliminar la categoría/).closest('div')).toHaveClass('animate-pop-in');
  });

  it('el aviso de borrado sale con una animación de salida y luego desaparece', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CategoryManagerModal onClose={vi.fn()} onCascadeRequired={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Alquiler' }));

    const confirmation = screen.getByText(/¿Eliminar la categoría/);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(confirmation.closest('div')).toHaveClass('animate-pop-out');
    expect(confirmation.closest('div')).not.toHaveClass('animate-pop-in');

    await waitFor(() => {
      expect(screen.queryByText(/¿Eliminar la categoría/)).toBeNull();
    });
  });

  it('el aviso de borrado sale con una animación de salida tras eliminar la categoría', async () => {
    const user = userEvent.setup();
    const remove = mutationMock({ mutateAsync: vi.fn().mockResolvedValueOnce(undefined) });
    vi.mocked(useDeleteExpenseCategory).mockReturnValue(remove as never);

    renderWithProviders(<CategoryManagerModal onClose={vi.fn()} onCascadeRequired={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Borrar Alquiler' }));

    const confirmation = screen.getByText(/¿Eliminar la categoría/);
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(remove.mutateAsync).toHaveBeenCalledWith(1);
    });

    expect(confirmation.closest('div')).toHaveClass('animate-pop-out');

    await waitFor(() => {
      expect(screen.queryByText(/¿Eliminar la categoría/)).toBeNull();
    });
  });
});
