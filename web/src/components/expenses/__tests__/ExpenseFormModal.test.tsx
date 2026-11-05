import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useExpenses', () => ({
  useCreateExpense: vi.fn(),
  useUpdateExpense: vi.fn(),
}));

vi.mock('@/hooks/useExpenseCategories', () => ({
  useExpenseCategories: vi.fn(),
  useCreateExpenseCategory: vi.fn(),
}));

import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses';
import { useCreateExpenseCategory, useExpenseCategories } from '@/hooks/useExpenseCategories';
import { ExpenseFormModal } from '@/components/expenses/ExpenseFormModal';
import { renderWithProviders } from '@/test-utils/render';

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

const category = { id: 3, name: 'Alquiler', expenses_count: 2, total: 2400 };
const newCategory = { id: 9, name: 'Luz', expenses_count: 0, total: 0 };

describe('ExpenseFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExpenseCategories).mockReturnValue({
      data: [category],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateExpenseCategory).mockReturnValue(
      mutationMock({ mutateAsync: vi.fn().mockResolvedValue(newCategory) }) as never,
    );
    vi.mocked(useCreateExpense).mockReturnValue(mutationMock() as never);
    vi.mocked(useUpdateExpense).mockReturnValue(mutationMock() as never);
  });

  it('al crear una categoría en línea, la deja seleccionada en el formulario', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpenseFormModal mode="create" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '+ Nueva categoría' }));
    await user.type(screen.getByLabelText('Nombre de la nueva categoría'), 'Luz');
    await user.click(screen.getByRole('button', { name: 'Crear y usar' }));

    const select = screen.getByLabelText('Categoría *') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe('9');
    });
    expect(screen.getByRole('option', { name: 'Luz' })).toBeInTheDocument();
  });

  it('guarda el gasto con la categoría recién creada', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateExpense).mockReturnValue(mutationMock({ mutateAsync: create }) as never);

    renderWithProviders(<ExpenseFormModal mode="create" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '+ Nueva categoría' }));
    await user.type(screen.getByLabelText('Nombre de la nueva categoría'), 'Luz');
    await user.click(screen.getByRole('button', { name: 'Crear y usar' }));

    await user.type(screen.getByLabelText('Concepto *'), 'Factura de luz');
    fireEvent.change(screen.getByLabelText('Importe (€) *'), { target: { value: '45.5' } });
    fireEvent.change(screen.getByLabelText('Fecha *'), { target: { value: '2026-10-09' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        concept: 'Factura de luz',
        amount: 45.5,
        category_id: 9,
        expense_date: '2026-10-09',
      });
    });
  });
});
