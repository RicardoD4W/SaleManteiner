import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArmedRowProvider,
  RowActions,
  TravellingCell,
  useArmedRow,
  readArmedRow,
} from '../armedRow';
import { renderWithProviders } from '../../../test-utils/render';

interface Row {
  id: number;
  name: string;
}

function toDetail(row: Row) {
  return { id: row.id, name: row.name };
}

function Harness({
  row,
  prefix = 'buy',
  onQueryClient,
}: {
  row: Row;
  prefix?: string;
  onQueryClient?: (client: ReturnType<typeof useQueryClient>) => void;
}) {
  const { contextValue } = useArmedRow({
    transitionPrefix: prefix,
    detailKey: 'things',
    toDetail,
  });
  const queryClient = useQueryClient();
  if (onQueryClient) onQueryClient(queryClient);

  return (
    <ArmedRowProvider value={contextValue}>
      <TravellingCell row={row} field="product">
        {row.name}
      </TravellingCell>
      <RowActions
        row={row}
        editBasePath="/things"
        deleteAriaLabel={`Borrar ${row.name}`}
        onDelete={vi.fn()}
      />
      <button
        type="button"
        onClick={() => queryClient.setQueryData(['things', row.id], toDetail(row))}
      >
        primar
      </button>
    </ArmedRowProvider>
  );
}

describe('readArmedRow', () => {
  it('lee el id del state de la navegación', () => {
    expect(readArmedRow({ armedRowId: 7 })).toBe(7);
  });

  it('devuelve null si no hay id o no es un número', () => {
    expect(readArmedRow(null)).toBeNull();
    expect(readArmedRow('nope')).toBeNull();
    expect(readArmedRow({})).toBeNull();
    expect(readArmedRow({ armedRowId: '7' })).toBeNull();
  });
});

describe('la fila armada', () => {
  it('el nombre de la view transition es <prefijo>-<campo>-<id> cuando la fila está armada', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness row={{ id: 12, name: 'Funda iPhone 15' }} />);

    const cell = screen.getByText('Funda iPhone 15');
    expect(cell).toHaveClass('vt-cell');
    expect(cell.getAttribute('data-vt-name')).toBeNull();

    await user.hover(screen.getByRole('link', { name: 'Editar' }));

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone 15').getAttribute('data-vt-name')).toBe(
        'buy-product-12',
      );
    });
  });

  it('la fila que vuelve de la edición queda armada (viene del state)', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: '/things', state: { armedRowId: 12 } }]}>
          <Harness row={{ id: 12, name: 'Funda iPhone 15' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Funda iPhone 15').getAttribute('data-vt-name')).toBe('buy-product-12');
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/things/12');
  });

  it('armar la fila prima la caché del detalle con esa fila', async () => {
    const user = userEvent.setup();
    let client: ReturnType<typeof useQueryClient> | null = null;
    renderWithProviders(
      <Harness row={{ id: 12, name: 'Funda iPhone 15' }} onQueryClient={(c) => (client = c)} />,
    );

    await user.hover(screen.getByRole('link', { name: 'Editar' }));

    await waitFor(() => {
      expect(client?.getQueryData(['things', 12])).toEqual({ id: 12, name: 'Funda iPhone 15' });
    });
  });

  it('el link "Editar" lleva al detalle con la view transition', () => {
    renderWithProviders(<Harness row={{ id: 12, name: 'Funda iPhone 15' }} />);

    const link = screen.getByRole('link', { name: 'Editar' });
    expect(link).toHaveAttribute('href', '/things/12');
  });

  it('el botón "Borrar" conserva su aria-label y el cursor de puntero', () => {
    renderWithProviders(<Harness row={{ id: 12, name: 'Funda iPhone 15' }} />);

    const borrar = screen.getByRole('button', { name: 'Borrar Funda iPhone 15' });
    expect(borrar.className).toMatch(/cursor-pointer/);
  });
});
