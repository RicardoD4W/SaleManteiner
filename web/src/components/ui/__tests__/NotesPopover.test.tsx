import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesPopover } from '../NotesPopover';
import { renderWithProviders } from '@/test-utils/render';

describe('NotesPopover', () => {
  it('no pinta nada cuando no hay notas', () => {
    const { container } = renderWithProviders(<NotesPopover notes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('no pinta nada cuando las notas están en blanco', () => {
    const { container } = renderWithProviders(<NotesPopover notes="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pinta el icono de nota cuando hay notas', () => {
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    expect(screen.getByRole('img', { name: 'Notas: Paga al contado' })).toBeInTheDocument();
  });

  it('al pasar el ratón por encima muestra la nota entera en un popover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes={'Línea 1\nLínea 2'} />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    expect(screen.queryByRole('tooltip')).toBeNull();

    await user.hover(icon);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Línea 1');
    expect(tooltip).toHaveTextContent('Línea 2');
  });

  it('el popover desaparece al sacar el ratón', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.unhover(icon);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
