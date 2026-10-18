/**
 * Tests del componente SoldNewPage.
 *
 * Verifica:
 *  - El modal se abre al montar (ProductPickerModal visible).
 *  - Al confirmar la selección, el form se muestra.
 *  - Submit llama a useCreateSold.mutateAsync con el payload correcto.
 *  - El error 422 de stock insuficiente se muestra como alerta (S7).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateSold', () => ({
  useCreateSold: vi.fn(),
}));
vi.mock('@/hooks/useCreateCustomer', () => ({
  useCreateCustomer: vi.fn(),
}));
vi.mock('@/hooks/useBuysStock', () => ({
  useBuysStock: vi.fn(),
}));
vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));

import { useCreateSold } from '@/hooks/useCreateSold';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { useBuysStock } from '@/hooks/useBuysStock';
import { useCustomers } from '@/hooks/useCustomers';
import { SoldNewPage } from '@/pages/solds/SoldNewPage';
import { renderWithProviders } from '@/test-utils/render';
import type { Mock } from 'vitest';

function makeMutationResult(mutateAsync: Mock) {
  return {
    mutateAsync,
    mutate: mutateAsync,
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle' as const,
    data: undefined,
    error: null,
    reset: vi.fn(),
    variables: undefined,
    failureCount: 0,
    failureReason: null,
    context: undefined,
    submittedAt: 0,
  };
}

const mockBuys = [
  { id: 1, product_name: 'Funda iPhone', quantity: 10, disponibles: 8 },
];

const mockCustomers = [
  { id: 1, name: 'Juan Pérez', created_at: '2026-10-01T10:00:00.000Z' },
];

describe('SoldNewPage', () => {
  beforeEach(() => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuys as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
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
      status: 'idle' as const,
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
      context: undefined,
      variables: undefined,
    } as never);
    vi.mocked(useCreateSold).mockReturnValue(
      makeMutationResult(vi.fn().mockResolvedValue({
        id: 1,
        customer_id: 1,
        sale_price: 80,
        associated_costs: 3.5,
        sold_at: '2026-10-05',
        notes: null,
        created_at: '2026-10-05T10:00:00.000Z',
      })) as never,
    );
  });

  it('el modal se abre al montar (ProductPickerModal visible)', () => {
    renderWithProviders(<SoldNewPage />, { route: '/solds/new' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Scoped al dialog para evitar el botón "Seleccionar productos" del Card body.
    expect(within(dialog).getByText('Seleccionar productos')).toBeInTheDocument();
  });

  it('al confirmar la selección del modal, el form se muestra', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SoldNewPage />, { route: '/solds/new' });

    // Esperar que el modal se renderice.
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Tildar el checkbox del primer producto (scoped al dialog).
    const dialog = screen.getByRole('dialog');
    const checkbox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await user.click(checkbox!);

    // Confirmar (scoped al dialog para evitar el "Confirmar" del Card body si lo hubiera).
    await user.click(within(dialog).getByRole('button', { name: /Confirmar/ }));

    // El modal se cierra y aparece el form de venta.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Cliente/)).toBeInTheDocument();
    });
  });

  it('submit llama a create.mutateAsync con items y precio correcto', async () => {
    const user = userEvent.setup();
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: 1,
      customer_id: 1,
      sale_price: 80,
      associated_costs: 3.5,
      sold_at: '2026-10-05',
      notes: null,
      created_at: '2026-10-05T10:00:00.000Z',
    });
    vi.mocked(useCreateSold).mockReturnValue(makeMutationResult(createMutateAsync) as never);

    renderWithProviders(<SoldNewPage />, { route: '/solds/new' });

    // Esperar modal.
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const checkbox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await user.click(checkbox!);
    await user.click(within(dialog).getByRole('button', { name: /Confirmar/ }));

    // Esperar form.
    await waitFor(() => {
      expect(screen.getByLabelText(/Cliente/)).toBeInTheDocument();
    });

    // Seleccionar cliente.
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Juan Pérez'));

    // Cambiar precio.
    await user.clear(screen.getByLabelText(/Precio total/));
    await user.type(screen.getByLabelText(/Precio total/), '80');

    // Submit.
    await user.click(screen.getByRole('button', { name: /Crear venta/ }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload.customer_id).toBe(1);
    expect(payload.sale_price).toBe(80);
    expect(payload.items).toContainEqual({ buy_id: 1, quantity: 1 });
  });

  it('error 422 de stock insuficiente se muestra como alerta', async () => {
    const user = userEvent.setup();
    const apiError = {
      status: 422,
      body: {
        error: 'Stock insuficiente',
        items: [
          { buy_id: 1, product_name: 'Funda iPhone', disponibles: 8, solicitado: 10 },
        ],
      },
    };
    vi.mocked(useCreateSold).mockReturnValue(
      makeMutationResult(vi.fn().mockRejectedValue(apiError) as unknown as never) as never,
    );

    renderWithProviders(<SoldNewPage />, { route: '/solds/new' });

    // Esperar modal.
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    const checkbox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await user.click(checkbox!);
    await user.click(within(dialog).getByRole('button', { name: /Confirmar/ }));

    // Esperar form.
    await waitFor(() => {
      expect(screen.getByLabelText(/Cliente/)).toBeInTheDocument();
    });

    // Seleccionar cliente.
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Juan Pérez'));

    // Submit.
    await user.click(screen.getByRole('button', { name: /Crear venta/ }));

    await waitFor(() => {
      // El item list "intentaste vender" es único del stockError, no del generic errors.root.
      expect(screen.getByText(/intentaste vender 10/)).toBeInTheDocument();
    });
  });
});
