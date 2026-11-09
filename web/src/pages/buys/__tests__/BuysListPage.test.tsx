import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useBuys', () => ({
  useBuys: vi.fn(),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 44,
        size: 44,
      })),
    getTotalSize: () => count * 44,
    measureElement: () => {},
  }),
}));

import { useBuys } from '@/hooks/useBuys';
import { BuysListPage } from '@/pages/buys/BuysListPage';
import { renderWithProviders } from '@/test-utils/render';
import { presetRange } from '@/lib/dateRange';

const buysFixture = [
  {
    id: 1,
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
    total_cost: 910,
    associated_costs: 3.2,
    purchase_date: '2026-10-02',
    notes: null,
    created_at: '2026-10-02T10:00:00.000Z',
    disponibles: 17,
  },
];

const comprasConAcentos = [
  { ...buysFixture[0], id: 1, product_name: 'Zoe' },
  { ...buysFixture[0], id: 2, product_name: 'Álvaro' },
  { ...buysFixture[0], id: 3, product_name: 'ana' },
  { ...buysFixture[0], id: 4, product_name: 'Cañón' },
];

describe('BuysListPage', () => {
  beforeEach(() => {
    vi.mocked(useBuys).mockReturnValue({
      data: buysFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('muestra el coste del lote y el precio por unidad en columnas separadas', () => {
    renderWithProviders(<BuysListPage />);

    expect(screen.getByRole('columnheader', { name: 'Coste (€)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Precio unidad (€)' })).toBeInTheDocument();

    const fila = screen.getByText('Funda iPhone 15').closest('tr') as HTMLElement;
    expect(within(fila).getByText('910,00 €')).toBeInTheDocument();
    expect(within(fila).getByText('45,50 €')).toBeInTheDocument();
  });

  it('el botón "Borrar" de la fila muestra el cursor de puntero', () => {
    renderWithProviders(<BuysListPage />);

    const borrar = screen.getByRole('button', { name: 'Borrar Funda iPhone 15' });
    expect(borrar.className).toMatch(/cursor-pointer/);
  });

  it('ordena por producto con la misma regla que el resto de las tablas', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuys).mockReturnValue({
      data: comprasConAcentos as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('columnheader', { name: /Producto/ }));

    const productos = screen
      .getAllByRole('cell')
      .map((celda) => celda.textContent ?? '')
      .filter((texto) => ['Zoe', 'Álvaro', 'ana', 'Cañón'].includes(texto));

    expect(productos).toEqual(['Álvaro', 'ana', 'Cañón', 'Zoe']);
  });

  it('la cabecera se puede ordenar con el teclado', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    const cabecera = screen.getByRole('columnheader', { name: /Cantidad/ });
    cabecera.focus();
    expect(cabecera).toHaveAttribute('aria-sort', 'none');

    await user.keyboard('{Enter}');

    expect(cabecera).toHaveAttribute('aria-sort', 'ascending');
  });

  it('muestra el icono de notas solo en las compras que tienen notas', () => {
    vi.mocked(useBuys).mockReturnValue({
      data: [
        { ...buysFixture[0], id: 1, notes: null },
        { ...buysFixture[0], id: 2, product_name: 'Cargador', notes: 'Pedido a la marca' },
      ] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    const conNotas = screen.getByText('Cargador').closest('tr') as HTMLElement;
    const sinNotas = screen.getByText('Funda iPhone 15').closest('tr') as HTMLElement;

    expect(within(conNotas).getByRole('img', { name: /Notas/ })).toBeInTheDocument();
    expect(within(sinNotas).queryByRole('img', { name: /Notas/ })).toBeNull();
  });

  it('al pasar el ratón por encima del icono se ve la nota entera en un popover', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuys).mockReturnValue({
      data: [{ ...buysFixture[0], notes: 'Pedido a la marca' }] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Pedido a la marca');
  });

  it('al elegir un preset pide las compras de ese período', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));

    expect(useBuys).toHaveBeenLastCalledWith(presetRange('month'));
  });

  it('"Quitar filtro" deja la lista sin rango', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    await user.click(screen.getByRole('button', { name: 'Quitar filtro' }));

    expect(useBuys).toHaveBeenLastCalledWith({});
  });

  it('sin compras y sin filtro avisa de que no hay compras todavía', () => {
    vi.mocked(useBuys).mockReturnValue({
      data: [] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    expect(screen.getByText('No hay compras todavía.')).toBeInTheDocument();
  });

  it('sin compras dentro del período avisa de que el período está vacío', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuys).mockReturnValue({
      data: [] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));

    expect(screen.getByText('No hay compras en este período.')).toBeInTheDocument();
  });
});
