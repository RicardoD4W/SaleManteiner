import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeleteTagCascade } from '@/components/tags/DeleteTagCascade';
import { renderWithProviders } from '@/test-utils/render';
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

describe('DeleteTagCascade', () => {
  it('avisa de cuántas compras tienen el tag y las lista', () => {
    renderWithProviders(
      <DeleteTagCascade
        tagName="Urgente"
        buys={[buyFixture()]}
        isPending={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/El tag/)).toHaveTextContent('Urgente');
    expect(screen.getByText(/tiene/)).toHaveTextContent('1 compra');
    expect(screen.getByText(/sin etiqueta/)).toBeInTheDocument();
    expect(screen.getByText(/Las compras no se borran/)).toBeInTheDocument();
    expect(screen.getByText('Funda etiquetada')).toBeInTheDocument();
  });

  it('lista cada producto con su fecha, su coste y sus unidades', () => {
    renderWithProviders(
      <DeleteTagCascade
        tagName="Urgente"
        buys={[buyFixture()]}
        isPending={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const row = screen.getByText('Funda etiquetada').closest('li');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('3 unidades');
    expect(row).toHaveTextContent('15,00');
  });

  it('confirma el borrado y cancela', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderWithProviders(
      <DeleteTagCascade
        tagName="Urgente"
        buys={[buyFixture()]}
        isPending={false}
        error={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Sí, borrar el tag' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('muestra el error del borrado', () => {
    renderWithProviders(
      <DeleteTagCascade
        tagName="Urgente"
        buys={[buyFixture()]}
        isPending={false}
        error="No se pudo borrar el tag"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo borrar el tag');
  });

  it('sin compras afectadas no lista nada y avisa de que no cambia nada', () => {
    renderWithProviders(
      <DeleteTagCascade
        tagName="Urgente"
        buys={[]}
        isPending={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/no tiene compras/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
