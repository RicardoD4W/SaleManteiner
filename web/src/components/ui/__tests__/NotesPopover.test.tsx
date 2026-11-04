import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

  it('el popover sigue visible un instante después de sacar el ratón (para poder llegar hasta él)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    await screen.findByRole('tooltip');

    await user.unhover(icon);

    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });

  it('el popover permanece abierto si el ratón entra en él', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    const tooltip = await screen.findByRole('tooltip');

    await user.unhover(icon);
    await user.hover(tooltip);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });

  it('el popover desaparece al sacar el ratón', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.unhover(icon);

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull(), { timeout: 2000 });
  });

  it('el popover se desvanece al salir y desaparece del DOM', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    const tooltip = await screen.findByRole('tooltip');

    await waitFor(() => expect(tooltip).toHaveStyle({ opacity: '1' }));

    await user.unhover(icon);

    await waitFor(() => expect(tooltip).toHaveStyle({ opacity: '0' }), { timeout: 2000 });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull(), { timeout: 2000 });
  });

  it('el popover se posiciona en píxeles medidos, no con valores fijos', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotesPopover notes="Paga al contado" />);

    const icon = screen.getByRole('img', { name: /Notas/ });
    await user.hover(icon);
    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip.style.top).not.toBe('');
    expect(tooltip.style.left).not.toBe('');
    expect(tooltip.style.minWidth).toBe('80px');
    expect(tooltip.style.maxWidth).toBe('280px');
  });
});
