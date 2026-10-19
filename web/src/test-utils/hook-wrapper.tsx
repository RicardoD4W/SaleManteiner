/**
 * Helper para tests de hooks de TanStack Query. Crea un QueryClient
 * fresco por test (sin caché compartida entre tests) y devuelve un
 * wrapper que provee ese client.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export interface HookTestEnv {
  qc: QueryClient;
  Wrapper: ({ children }: { children: ReactNode }) => ReactNode;
}

export function makeHookWrapper(): HookTestEnv {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}
