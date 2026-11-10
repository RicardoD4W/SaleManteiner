import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(),
}));

import { useTags } from '@/hooks/useTags';
import { TagFilter } from '@/components/tags/TagFilter';
import { renderWithProviders } from '@/test-utils/render';

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

function renderFilter(value: { tagIds?: number[]; sinTag?: boolean } = {}) {
  const onChange = vi.fn();
  const onManage = vi.fn();
  renderWithProviders(<TagFilter value={value} onChange={onChange} onManage={onManage} />);
  return { onChange, onManage };
}

describe('TagFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTags).mockReturnValue({
      data: tagsFixture,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('muestra un chip por tag con su nombre y el color del tag', () => {
    renderFilter();

    const chip = screen.getByRole('button', { name: 'Urgente' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(within(chip).getByTestId('tag-swatch')).toHaveStyle({
      backgroundColor: 'rgb(220, 38, 38)',
    });

    const oferta = screen.getByRole('button', { name: 'Oferta' });
    expect(within(oferta).getByTestId('tag-swatch')).toHaveStyle({
      backgroundColor: 'rgb(22, 163, 74)',
    });
  });

  it('al pulsar un chip lo añade a tagIds', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter();

    await user.click(screen.getByRole('button', { name: 'Urgente' }));

    expect(onChange).toHaveBeenCalledWith({ tagIds: [1] });
  });

  it('al pulsar un chip ya seleccionado lo quita de tagIds', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ tagIds: [1] });

    await user.click(screen.getByRole('button', { name: 'Urgente' }));

    expect(onChange).toHaveBeenCalledWith({ tagIds: [] });
  });

  it('varios tags pueden estar marcados a la vez (semántica OR)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ tagIds: [1] });

    await user.click(screen.getByRole('button', { name: 'Oferta' }));

    expect(onChange).toHaveBeenCalledWith({ tagIds: [1, 2] });
  });

  it('"Sin tag" es excluyente y limpia los tags marcados', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ tagIds: [1] });

    await user.click(screen.getByRole('button', { name: 'Sin tag' }));

    expect(onChange).toHaveBeenCalledWith({ sinTag: true });
  });

  it('al elegir un tag se quita "Sin tag"', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ sinTag: true });

    await user.click(screen.getByRole('button', { name: 'Urgente' }));

    expect(onChange).toHaveBeenCalledWith({ tagIds: [1] });
  });

  it('"Gestionar tags" avisa al padre', async () => {
    const user = userEvent.setup();
    const { onManage } = renderFilter();

    await user.click(screen.getByRole('button', { name: 'Gestionar tags' }));

    expect(onManage).toHaveBeenCalled();
  });

  it('el botón de limpiar deja el filtro vacío', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ tagIds: [1] });

    await user.click(screen.getByRole('button', { name: 'Quitar filtro de tags' }));

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('sin tags en el catálogo sigue offering el chip "Sin tag" y el botón de gestión', () => {
    vi.mocked(useTags).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderFilter();

    expect(screen.getByRole('button', { name: 'Sin tag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestionar tags' })).toBeInTheDocument();
  });
});
