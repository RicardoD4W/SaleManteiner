/**
 * Tests del componente CustomerAutocomplete.
 *
 * Verifica:
 *  - Renderiza input y label.
 *  - Filtra clientes por nombre tipeado.
 *  - Selección de cliente.
 *  - Opción "Crear cliente" cuando no hay exact match.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));
vi.mock('@/hooks/useCreateCustomer', () => ({
  useCreateCustomer: vi.fn(),
}));

import { useCustomers } from '@/hooks/useCustomers';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { CustomerAutocomplete } from '@/components/sales/CustomerAutocomplete';
import { renderWithProviders } from '@/test-utils/render';

const mockCustomers = [
  { id: 1, name: 'Juan Pérez', created_at: '2026-10-01T10:00:00.000Z' },
  { id: 2, name: 'Ana García', created_at: '2026-10-02T10:00:00.000Z' },
  { id: 3, name: 'Carlos Ruiz', created_at: '2026-10-03T10:00:00.000Z' },
];

describe('CustomerAutocomplete', () => {
  beforeEach(() => {
    vi.mocked(useCustomers).mockReturnValue({
      data: mockCustomers as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateCustomer).mockReturnValue({
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
    } as never);
  });

  it('renderiza el label y el input', () => {
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={vi.fn()} />,
    );

    expect(screen.getByText('Cliente *')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('al tipear muestra la lista filtrada por nombre', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={vi.fn()} />,
    );

    await user.type(screen.getByRole('combobox'), 'juan');

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    // Ana y Carlos no coinciden.
    expect(screen.queryByText('Ana García')).not.toBeInTheDocument();
    expect(screen.queryByText('Carlos Ruiz')).not.toBeInTheDocument();
  });

  it('al tipear un nombre inexacto muestra opción "Crear cliente"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={vi.fn()} />,
    );

    await user.type(screen.getByRole('combobox'), 'Pedro');

    await waitFor(() => {
      expect(screen.getByText(/Crear cliente "Pedro"/)).toBeInTheDocument();
    });
  });

  it('al hacer click en un cliente llama a onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={onChange} />,
    );

    await user.type(screen.getByRole('combobox'), 'juan');
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Juan Pérez'));

    expect(onChange).toHaveBeenCalledWith(mockCustomers[0]);
  });

  it('el exact match NO muestra "Crear cliente"', async () => {
    // Con startsWith, "juan" coincide con "Juan Pérez" (empieza con "juan").
    // El exact match es case-insensitive: "Juan Pérez".toLowerCase() === "Juan Pérez".toLowerCase().
    // Si tipeamos "Juan Pérez" (full name), no debe aparecer "Crear cliente".
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={vi.fn()} />,
    );

    await user.type(screen.getByRole('combobox'), 'Juan Pérez');
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    // Exact match: "juan pé rez" === "juan pé rez" (case-insensitive) → showCreateOption = false.
    expect(screen.queryByText(/Crear cliente/)).not.toBeInTheDocument();
  });

  it('el botón "Crear cliente" llama a useCreateCustomer.mutateAsync', async () => {
    const user = userEvent.setup();
    const newCustomer = { id: 99, name: 'Pedro', created_at: '2026-10-10T10:00:00.000Z' };
    vi.mocked(useCreateCustomer).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValueOnce(newCustomer as never),
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
    } as never);

    const onChange = vi.fn();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={onChange} />,
    );

    await user.type(screen.getByRole('combobox'), 'Pedro');
    await waitFor(() => {
      expect(screen.getByText(/Crear cliente "Pedro"/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Crear cliente "Pedro"/));

    await waitFor(() => {
      const { mutateAsync } = vi.mocked(useCreateCustomer)();
      expect(mutateAsync).toHaveBeenCalledWith({ name: 'Pedro' });
    });
  });

  it('al seleccionar un cliente cierra la lista', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerAutocomplete value={null} onChange={vi.fn()} />,
    );

    await user.type(screen.getByRole('combobox'), 'juan');
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Juan Pérez'));

    await waitFor(() => {
      // La lista ya no está visible.
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
