import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateCustomer', () => ({
  useCreateCustomer: vi.fn(),
}));
vi.mock('@/hooks/useUpdateCustomer', () => ({
  useUpdateCustomer: vi.fn(),
}));

import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { useUpdateCustomer } from '@/hooks/useUpdateCustomer';
import { CustomerFormModal } from '@/components/sales/CustomerFormModal';
import { ApiError } from '@/api/client';
import { renderWithProviders } from '@/test-utils/render';

const customerFixture = {
  id: 7,
  name: 'Juan Pérez',
  created_at: '2026-10-01T10:00:00.000Z',
};

function mutationMock(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
    ...overrides,
  };
}

describe('CustomerFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateCustomer).mockReturnValue(mutationMock() as never);
    vi.mocked(useUpdateCustomer).mockReturnValue(mutationMock() as never);
  });

  it('renderiza el diálogo con el título y el campo de nombre', () => {
    renderWithProviders(<CustomerFormModal mode="create" onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toBeInTheDocument();
  });

  it('en modo edición muestra el nombre actual del cliente', () => {
    renderWithProviders(
      <CustomerFormModal mode="edit" customer={customerFixture} onClose={vi.fn()} />,
    );

    expect(screen.getByText('Editar cliente')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Juan Pérez');
  });

  it('no guarda un nombre vacío: avisa con role="alert" y no llama al hook', async () => {
    const user = userEvent.setup();
    const create = mutationMock();
    vi.mocked(useCreateCustomer).mockReturnValue(create as never);

    renderWithProviders(<CustomerFormModal mode="create" onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/obligatorio/i);
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('un nombre de solo espacios no llega al servidor', async () => {
    const user = userEvent.setup();
    const create = mutationMock();
    vi.mocked(useCreateCustomer).mockReturnValue(create as never);

    renderWithProviders(<CustomerFormModal mode="create" onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre *'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El nombre es obligatorio');
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('llama a useCreateCustomer con el nombre y cierra al guardar', async () => {
    const user = userEvent.setup();
    const create = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce(customerFixture),
    });
    vi.mocked(useCreateCustomer).mockReturnValue(create as never);
    const onClose = vi.fn();

    renderWithProviders(<CustomerFormModal mode="create" onClose={onClose} />);

    await user.type(screen.getByLabelText('Nombre *'), 'Ana García');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(create.mutateAsync).toHaveBeenCalledWith({ name: 'Ana García' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('en modo edición llama a useUpdateCustomer con el id del cliente y cierra', async () => {
    const user = userEvent.setup();
    const update = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce({ ...customerFixture, name: 'Ana García' }),
    });
    vi.mocked(useUpdateCustomer).mockReturnValue(update as never);
    const onClose = vi.fn();

    renderWithProviders(
      <CustomerFormModal mode="edit" customer={customerFixture} onClose={onClose} />,
    );

    const input = screen.getByLabelText('Nombre *');
    await user.clear(input);
    await user.type(input, 'Ana García');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: customerFixture.id,
        input: { name: 'Ana García' },
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('si el servidor falla muestra el error y NO cierra el modal', async () => {
    const user = userEvent.setup();
    const create = mutationMock({
      mutateAsync: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(409, { error: 'No se pudo guardar' })),
    });
    vi.mocked(useCreateCustomer).mockReturnValue(create as never);
    const onClose = vi.fn();

    renderWithProviders(<CustomerFormModal mode="create" onClose={onClose} />);

    await user.type(screen.getByLabelText('Nombre *'), 'Ana García');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape cierra el modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(<CustomerFormModal mode="create" onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('el foco vuelve al elemento que abrió el modal', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Abrir
          </button>
          {isOpen ? <CustomerFormModal mode="create" onClose={() => setIsOpen(false)} /> : null}
        </>
      );
    }

    renderWithProviders(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText('Nombre *')).toHaveFocus();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
