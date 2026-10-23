import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;

  withRouter?: boolean;

  withQueryClient?: boolean;
}

function makeWrapper({ route, withRouter = true, withQueryClient = true }: Options) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    let node: ReactNode = children;
    if (withQueryClient) {
      node = <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
    }
    if (withRouter) {
      node = <MemoryRouter initialEntries={[route ?? '/']}>{node}</MemoryRouter>;
    }
    return <>{node}</>;
  };
}

export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
  return render(ui, { wrapper: makeWrapper(options), ...options });
}
