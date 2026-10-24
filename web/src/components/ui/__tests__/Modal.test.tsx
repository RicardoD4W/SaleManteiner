import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { renderWithProviders } from '@/test-utils/render';

function RefFocusModal({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Modal title="Con ref" onClose={onClose} initialFocusRef={inputRef}>
      <input ref={inputRef} aria-label="Campo" />
    </Modal>
  );
}

describe('Modal', () => {
  it('es un diálogo modal con el título como nombre accesible', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()}>
        <p>Cuerpo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Nueva compra');
    expect(screen.getByText('Cuerpo')).toBeInTheDocument();
  });

  it('el botón Cerrar llama a onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal title="Nueva compra" onClose={onClose}>
        <p>Cuerpo</p>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape cierra el diálogo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal title="Nueva compra" onClose={onClose}>
        <p>Cuerpo</p>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape no cierra mientras isPending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal title="Nueva compra" onClose={onClose} isPending>
        <p>Cuerpo</p>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el click en el backdrop cierra el diálogo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal title="Nueva compra" onClose={onClose}>
        <p>Cuerpo</p>
      </Modal>,
    );

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el backdrop no cierra mientras isPending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal title="Nueva compra" onClose={onClose} isPending>
        <p>Cuerpo</p>
      </Modal>,
    );

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el botón Cerrar está deshabilitado mientras isPending', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()} isPending>
        <p>Cuerpo</p>
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
  });

  it('el foco inicial va al primer elemento enfocable del diálogo', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()}>
        <button type="button">Acción</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('initialFocusSelector enfoca el elemento que indica', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()} initialFocusSelector="input">
        <input aria-label="Producto" />
      </Modal>,
    );

    expect(screen.getByLabelText('Producto')).toHaveFocus();
  });

  it('initialFocusRef enfoca el elemento que referencia', () => {
    renderWithProviders(<RefFocusModal onClose={vi.fn()} />);

    expect(screen.getByLabelText('Campo')).toHaveFocus();
  });

  it('el focus trap no deja salir el foco del diálogo', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()}>
        <button type="button">Acción</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    const actionButton = screen.getByRole('button', { name: 'Acción' });

    actionButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(actionButton).toHaveFocus();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('el foco vuelve al elemento disparador al cerrar', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Abrir
          </button>
          {isOpen ? <Modal title="Nueva compra" onClose={() => setIsOpen(false)} /> : null}
        </>
      );
    }

    renderWithProviders(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('aria-describedby apunta a la descripción indicada', () => {
    renderWithProviders(
      <Modal title="Eliminar compra" onClose={vi.fn()} describedById="descripcion-compra">
        <p id="descripcion-compra">¿Eliminar esta compra? No se puede deshacer.</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'descripcion-compra');
  });

  it('renderiza el footer en su propio slot', () => {
    renderWithProviders(
      <Modal
        title="Seleccionar productos"
        onClose={vi.fn()}
        footer={<button type="button">Confirmar (1)</button>}
      >
        <p>Cuerpo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'Confirmar (1)' }));
    expect(screen.getByRole('button', { name: 'Confirmar (1)' })).toHaveTextContent(
      'Confirmar (1)',
    );
  });

  it('el shell conserva el backdrop y las clases del diálogo del repo', () => {
    renderWithProviders(
      <Modal title="Nueva compra" onClose={vi.fn()} size="wide">
        <p>Cuerpo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;

    expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50', 'bg-black/50', 'p-4');
    expect(dialog).toHaveClass(
      'flex',
      'max-h-[90vh]',
      'w-full',
      'max-w-2xl',
      'flex-col',
      'overflow-y-auto',
      'rounded-xl',
      'border',
      'border-gray-200',
      'bg-white',
      'shadow-2xl',
      'dark:border-gray-800',
      'dark:bg-gray-900',
    );
  });
});
