import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/customers', () => ({
  customersApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    search: vi.fn(),
  },
}));

import { customersApi } from '@/api/customers';
import { useCustomers } from '@/hooks/useCustomers';

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

const customersFixture = [
  { id: 1, name: 'Juan Pérez', created_at: '2026-10-01T10:00:00.000Z' },
  { id: 2, name: 'Ana García', created_at: '2026-10-02T10:00:00.000Z' },
];

describe('useCustomers', () => {
  beforeEach(() => {
    vi.mocked(customersApi.list).mockReset();
  });

  it('llama a customersApi.list y devuelve los datos', async () => {
    vi.mocked(customersApi.list).mockResolvedValueOnce(customersFixture as never);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomers(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customersApi.list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(customersFixture);
  });

  it('devuelve error si customersApi.list rechaza', async () => {
    vi.mocked(customersApi.list).mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomers(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
