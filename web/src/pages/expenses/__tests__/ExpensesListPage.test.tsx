import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/expenses', () => ({
  expensesApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  expenseCategoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { expenseCategoriesApi, expensesApi } from '@/api/expenses';
import { ExpensesListPage } from '@/pages/expenses/ExpensesListPage';
import { ApiError } from '@/api/client';
import { formatEuro } from '@/lib/format';
import { renderWithProviders } from '@/test-utils/render';

const categoriesFixture = [
  { id: 3, name: 'Alquiler', expenses_count: 2, total: 2400 },
  { id: 4, name: 'Suministros', expenses_count: 1, total: 150 },
];

function euro(value: number): string {
  return formatEuro(value).replace(/\u00a0/g, ' ');
}

const expensesFixture = [
  {
    id: 1,
    concept: 'Alquiler de octubre',
    amount: 1200,
    category_id: 3,
    expense_date: '2026-10-02',
    created_at: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 2,
    concept: 'Papel de impresora',
    amount: 150,
    category_id: 4,
    expense_date: '2026-10-05',
    created_at: '2026-10-05T10:00:00.000Z',
  },
];

function conceptOrder(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
}

describe('ExpensesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(expensesApi.list).mockResolvedValue([...expensesFixture]);
    vi.mocked(expenseCategoriesApi.list).mockResolvedValue([...categoriesFixture]);
    vi.mocked(expensesApi.create).mockResolvedValue(expensesFixture[0]);
    vi.mocked(expensesApi.remove).mockResolvedValue(undefined);
  });

  it('muestra los gastos con su categoría, su importe y su fecha', async () => {
    renderWithProviders(<ExpensesListPage />);

    expect(await screen.findByText('Alquiler de octubre')).toBeInTheDocument();
    expect(screen.getByText('Papel de impresora')).toBeInTheDocument();
    expect(screen.getByText(euro(1200))).toBeInTheDocument();
    expect(screen.getByText(euro(150))).toBeInTheDocument();
    expect(screen.getByText('02/10/2026')).toBeInTheDocument();
  });

  it('ordena los gastos por importe y marca la cabecera', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');
    const cabecera = screen.getByRole('columnheader', { name: /^Importe/ });

    await user.click(cabecera);

    expect(conceptOrder()).toEqual(['Papel de impresora', 'Alquiler de octubre']);
    expect(cabecera).toHaveAttribute('aria-sort', 'ascending');

    await user.click(cabecera);

    expect(conceptOrder()).toEqual(['Alquiler de octubre', 'Papel de impresora']);
    expect(cabecera).toHaveAttribute('aria-sort', 'descending');
  });

  it('ordena los gastos por concepto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('columnheader', { name: /^Concepto/ }));

    expect(conceptOrder()).toEqual(['Alquiler de octubre', 'Papel de impresora']);

    await user.click(screen.getByRole('columnheader', { name: /^Concepto/ }));

    expect(conceptOrder()).toEqual(['Papel de impresora', 'Alquiler de octubre']);
  });

  it('ordena los gastos por el nombre de la categoría', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('columnheader', { name: /^Categoría/ }));

    expect(conceptOrder()).toEqual(['Alquiler de octubre', 'Papel de impresora']);

    await user.click(screen.getByRole('columnheader', { name: /^Categoría/ }));

    expect(conceptOrder()).toEqual(['Papel de impresora', 'Alquiler de octubre']);
  });

  it('ordena los gastos por fecha', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');
    const cabecera = screen.getByRole('columnheader', { name: /^Fecha/ });

    await user.click(cabecera);

    expect(conceptOrder()).toEqual(['Alquiler de octubre', 'Papel de impresora']);

    await user.click(cabecera);

    expect(conceptOrder()).toEqual(['Papel de impresora', 'Alquiler de octubre']);
  });

  it('el total de la lista no cambia al ordenar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('columnheader', { name: /^Importe/ }));

    expect(screen.getByText(`Total: ${euro(1350)}`)).toBeInTheDocument();
  });

  it('el filtro por categoría pide solo los gastos de esa categoría', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');
    vi.mocked(expensesApi.list).mockClear();

    await user.selectOptions(screen.getByLabelText('Categoría'), '4');

    await waitFor(() => {
      expect(expensesApi.list).toHaveBeenCalledWith(4);
    });
  });

  it('muestra el total de los gastos de la lista', async () => {
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    expect(screen.getByText(`Total: ${euro(1350)}`)).toBeInTheDocument();
  });

  it('da de alta un gasto desde el modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('button', { name: '+ Nuevo gasto' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Concepto *'), 'Luz del taller');
    fireEvent.change(within(dialog).getByLabelText('Importe (€) *'), {
      target: { value: '45.5' },
    });
    fireEvent.change(within(dialog).getByLabelText('Fecha *'), {
      target: { value: '2026-10-09' },
    });
    await user.selectOptions(within(dialog).getByLabelText('Categoría *'), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(expensesApi.create).toHaveBeenCalledWith({
        concept: 'Luz del taller',
        amount: 45.5,
        category_id: 4,
        expense_date: '2026-10-09',
      });
    });
  });

  it('borra un gasto desde la fila', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('button', { name: 'Borrar Alquiler de octubre' }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(expensesApi.remove).toHaveBeenCalledWith(1);
    });
  });

  it('no borra una categoría en uso: avisa del 409 y la mantiene en la lista', async () => {
    const user = userEvent.setup();
    vi.mocked(expenseCategoriesApi.remove).mockRejectedValue(
      new ApiError(409, { error: 'La categoría tiene gastos asociados' }),
    );

    renderWithProviders(<ExpensesListPage />);

    await screen.findByText('Alquiler de octubre');

    await user.click(screen.getByRole('button', { name: 'Gestionar categorías' }));

    const dialogs = screen.getAllByRole('dialog');
    const manager = dialogs[dialogs.length - 1];

    await user.click(within(manager).getByRole('button', { name: 'Borrar Alquiler' }));
    await user.click(within(manager).getByRole('button', { name: 'Sí, eliminar' }));

    expect(
      await within(manager).findByText(
        'No se puede borrar la categoría porque tiene gastos asociados.',
      ),
    ).toBeInTheDocument();
    expect(within(manager).getByText('Alquiler')).toBeInTheDocument();
  });
});
