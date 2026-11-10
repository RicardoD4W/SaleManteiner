import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useBuys', () => ({
  useBuys: vi.fn(),
}));

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(),
  useCreateTag: vi.fn(),
  useUpdateTag: vi.fn(),
  useDeleteTag: vi.fn(),
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
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/hooks/useTags';
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
    tag: null,
    created_at: '2026-10-02T10:00:00.000Z',
    disponibles: 17,
  },
];

const buysConTags = [
  { ...buysFixture[0], id: 1, tag: { id: 3, name: 'Urgente', color: '#dc2626' } },
  { ...buysFixture[0], id: 2, product_name: 'Cargador', tag: null },
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
    vi.mocked(useTags).mockReturnValue({
      data: [
        {
          id: 1,
          scope: 'buy',
          name: 'Urgente',
          color: '#dc2626',
          created_at: '2026-11-01T10:00:00.000Z',
          buy_count: 3,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateTag).mockReturnValue({ isPending: false } as never);
    vi.mocked(useUpdateTag).mockReturnValue({ isPending: false } as never);
    vi.mocked(useDeleteTag).mockReturnValue({ isPending: false } as never);
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

    expect(useBuys).toHaveBeenLastCalledWith(presetRange('month'), {});
  });

  it('"Quitar filtro" deja la lista sin rango', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    await user.click(screen.getByRole('button', { name: 'Quitar filtro' }));

    expect(useBuys).toHaveBeenLastCalledWith({}, {});
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

  it('la columna Tags está inmediatamente a la izquierda de la columna Notas', () => {
    renderWithProviders(<BuysListPage />);

    const cabeceras = screen.getAllByRole('columnheader').map((cabecera) => cabecera.textContent);
    const indiceTags = cabeceras.indexOf('Tags');
    const indiceNotas = cabeceras.indexOf('Notas');

    expect(indiceTags).toBeGreaterThanOrEqual(0);
    expect(indiceNotas).toBe(indiceTags + 1);
  });

  it('muestra el icono de tag solo en las compras que tienen tag', () => {
    vi.mocked(useBuys).mockReturnValue({
      data: buysConTags as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    const conTag = screen.getByText('Funda iPhone 15').closest('tr') as HTMLElement;
    const sinTag = screen.getByText('Cargador').closest('tr') as HTMLElement;

    expect(within(conTag).getByRole('img', { name: 'Tag: Urgente' })).toBeInTheDocument();
    expect(within(sinTag).queryByRole('img', { name: /Tag:/ })).toBeNull();
  });

  it('tiñe la fila de las compras con tag y deja intacta la fila sin tag', () => {
    vi.mocked(useBuys).mockReturnValue({
      data: buysConTags as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    const conTag = screen.getByText('Funda iPhone 15').closest('tr') as HTMLElement;
    const sinTag = screen.getByText('Cargador').closest('tr') as HTMLElement;

    expect(conTag.className).toContain('tag-row-tinted');
    expect(conTag.style.getPropertyValue('--tag-color')).toBe('#dc2626');

    expect(sinTag.className).not.toContain('tag-row-tinted');
    expect(sinTag.style.getPropertyValue('--tag-color')).toBe('');
  });

  it('el filtro de tags se pinta junto al filtro de fechas', () => {
    renderWithProviders(<BuysListPage />);

    expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestionar tags' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Urgente' })).toBeInTheDocument();
  });

  it('al elegir un tag pide las compras con ese tag', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    await user.click(screen.getByRole('button', { name: 'Urgente' }));

    expect(useBuys).toHaveBeenLastCalledWith({}, { tagIds: [1] });
  });

  it('"Gestionar tags" abre el modal gestor de tags', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuysListPage />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Gestionar tags' }));

    expect(await screen.findByRole('dialog', { name: 'Tags de compra' })).toBeInTheDocument();
  });

  it('sin compras también se puede filtrar y gestionar tags', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuys).mockReturnValue({
      data: [] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    expect(screen.getByRole('button', { name: 'Gestionar tags' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gestionar tags' }));

    expect(await screen.findByRole('dialog', { name: 'Tags de compra' })).toBeInTheDocument();
  });

  it('centra las columnas de iconos: Tags, Notas y acciones', () => {
    vi.mocked(useBuys).mockReturnValue({
      data: [
        {
          ...buysFixture[0],
          notes: 'Una nota',
          tag: { id: 3, name: 'Urgente', color: '#dc2626' },
        },
      ] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<BuysListPage />);

    expect(screen.getByRole('columnheader', { name: 'Tags' })).toHaveClass('text-center');
    expect(screen.getByRole('columnheader', { name: 'Notas' })).toHaveClass('text-center');

    expect(screen.getByRole('img', { name: 'Tag: Urgente' }).closest('td')).toHaveClass(
      'text-center',
    );
    expect(screen.getByRole('img', { name: 'Notas: Una nota' }).closest('td')).toHaveClass(
      'text-center',
    );
    expect(screen.getByRole('link', { name: /Editar/ }).closest('td')).toHaveClass('text-center');
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
