import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { renderWithProviders } from '@/test-utils/render';

function Harness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Borrar Funda iPhone
      </button>
      {open ? (
        <ConfirmDeleteModal
          title="Eliminar compra"
          description={
            <>
              ¿Eliminar <strong>"Funda iPhone"</strong>? No se puede deshacer.
            </>
          }
          confirmLabel="Sí, eliminar"
          onClose={() => setOpen(false)}
          onConfirm={onConfirm}
        />
      ) : null}
    </div>
  );
}

describe('ConfirmDeleteModal', () => {
  it('es un diálogo modal con título y descripción', () => {
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra? No se puede deshacer.</>}
        confirmLabel="Sí, eliminar"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Eliminar compra');
    expect(screen.getByText('¿Eliminar esta compra? No se puede deshacer.')).toBeInTheDocument();
  });

  it('el botón de confirmar llama a onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        confirmLabel="Sí, eliminar"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('muestra el error con role="alert"', () => {
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        error="Error de red"
        confirmLabel="Sí, eliminar"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error de red');
  });

  it('Escape cierra la modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        confirmLabel="Sí, eliminar"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape no cierra mientras la mutación está en curso', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        isPending
        confirmLabel="Sí, eliminar"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el click en el backdrop cierra la modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        confirmLabel="Sí, eliminar"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el focus trap no deja salir el foco del diálogo', () => {
    renderWithProviders(
      <ConfirmDeleteModal
        title="Eliminar compra"
        description={<>¿Eliminar esta compra?</>}
        confirmLabel="Sí, eliminar"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    const confirmButton = screen.getByRole('button', { name: 'Sí, eliminar' });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    confirmButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('el foco vuelve al elemento disparador al cerrar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness onConfirm={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Borrar Funda iPhone' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
