import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/customers', () => ({
  customersApi: {
    list: vi.fn(),
    getById: vi.fn(),
  },
}));

import { customersApi } from '@/api/customers';
import { useCustomer } from '@/hooks/useCustomer';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

const customerFixture = {
  id: 7,
  name: 'Ana García',
  phone: '612345678',
  address: 'Calle Mayor 1',
  notes: null,
  created_at: '2026-10-02T10:00:00.000Z',
};

describe('useCustomer', () => {
  beforeEach(() => {
    vi.mocked(customersApi.getById).mockReset();
  });

  it('pide el cliente por id y devuelve sus datos', async () => {
    vi.mocked(customersApi.getById).mockResolvedValueOnce(customerFixture as never);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomer(7), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customersApi.getById).toHaveBeenCalledWith(7);
    expect(result.current.data?.phone).toBe('612345678');
    expect(result.current.data?.address).toBe('Calle Mayor 1');
  });

  it('no pide nada con un id inválido', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useCustomer(0), { wrapper: Wrapper });

    expect(customersApi.getById).not.toHaveBeenCalled();
  });

  it('devuelve error si customersApi.getById rechaza', async () => {
    vi.mocked(customersApi.getById).mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomer(7), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
