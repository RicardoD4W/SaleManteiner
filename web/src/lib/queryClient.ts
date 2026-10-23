import { QueryClient, type QueryKey } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function invalidate(qc: QueryClient, ...queryKeys: QueryKey[]): void {
  for (const queryKey of queryKeys) {
    void qc.invalidateQueries({ queryKey });
  }
}
