/**
 * @fileoverview Helper compartido para envolver hooks/componentes en tests con
 * los providers reales (React Query, router, workspace) (renderWithProviders).
 *
 * @module renderWithProviders
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { renderHook, type RenderHookOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryDefaultOptions } from '../shared/query/queryClient';
import { WorkspaceProvider } from '../shared/workspace/WorkspaceContext';

/**
 * QueryClient de test: parte de los defaults reales de la app (staleTime
 * incluido — perderlo aquí haría que cada remount pareciera "stale" y
 * refetcheara siempre, justo el comportamiento que esta suite existe para
 * comprobar que NO ocurre) y solo desactiva reintentos y refetch por
 * foco/reconexión (jsdom no dispara esos eventos, pero mejor explícito).
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      ...queryDefaultOptions,
      queries: { ...queryDefaultOptions.queries, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { ...queryDefaultOptions.mutations, retry: false },
    },
  });
}

interface RenderHookWithProvidersOptions<Props> extends Omit<RenderHookOptions<Props>, 'wrapper'> {
  /** Ruta inicial del MemoryRouter. */
  route?: string;
  /** Envolver con WorkspaceProvider (por defecto sí: 3 de los 4 hooks de dominio lo usan). */
  withWorkspace?: boolean;
  /** QueryClient a reutilizar (p. ej. para simular un remount con caché ya poblada). */
  queryClient?: QueryClient;
}

export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: RenderHookWithProvidersOptions<Props>,
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const withWorkspace = options?.withWorkspace ?? true;

  function Wrapper({ children }: PropsWithChildren): ReactNode {
    const content = withWorkspace ? <WorkspaceProvider>{children}</WorkspaceProvider> : children;
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[options?.route ?? '/']}>{content}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...renderHook(hook, { ...options, wrapper: Wrapper }), queryClient };
}
