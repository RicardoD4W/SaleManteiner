import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteCustomerModal } from '@/components/sales/DeleteCustomerModal';
import { renderWithProviders } from '@/test-utils/render';
import type { AssociatedSale } from '@/api/types';

const SALES: AssociatedSale[] = [
  { id: 7, customer_name: 'Lucía Fernández', sold_at: '2026-10-21', items_count: 2 },
  { id: 9, customer_name: 'Lucía Fernández', sold_at: '2026-10-22', items_count: 1 },
];

describe('DeleteCustomerModal', () => {
  it('muestra el título y la lista de ventas asociadas', () => {
    renderWithProviders(
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending={false}
        cascadeError={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('El cliente tiene ventas asociadas')).toBeInTheDocument();
    expect(screen.getByText('"Lucía Fernández"')).toBeInTheDocument();
    expect(screen.getByText('Venta #7')).toBeInTheDocument();
    expect(screen.getByText('Venta #9')).toBeInTheDocument();
    expect(screen.getAllByText(/Lucía Fernández/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 ventas registradas/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
    ).toBeInTheDocument();
  });

  it('confirma el borrado en cascada', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending={false}
        cascadeError={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('muestra el error del cascade con role="alert"', () => {
    renderWithProviders(
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending={false}
        cascadeError="Error de red"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Error de red');
  });

  it('el foco inicial va al botón destructivo y el focus trap no deja salir', () => {
    renderWithProviders(
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending={false}
        cascadeError={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    const confirmButton = screen.getByRole('button', {
      name: 'Borrar también las ventas y el cliente',
    });

    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(cancelButton).toBeInTheDocument();
  });

  it('Escape cierra la modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending={false}
        cascadeError={null}
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
      <DeleteCustomerModal
        customerName="Lucía Fernández"
        sales={SALES}
        isPending
        cascadeError={null}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
