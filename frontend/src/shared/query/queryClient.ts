/**
 * @fileoverview Configuración compartida de React Query (queryClient).
 *
 * @module queryClient
 */

import { QueryClient, type DefaultOptions } from '@tanstack/react-query';
import type { ApiErrorPayload } from '../types';

function isClientError(error: unknown): boolean {
  const status = (error as Partial<ApiErrorPayload> | undefined)?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export const queryDefaultOptions: DefaultOptions = {
  queries: {
    // Reentrar a una pantalla dentro de esta ventana reutiliza caché: cero red, cero notificación.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    // http.ts ya normaliza cualquier error a ApiErrorPayload antes de que React Query lo vea,
    // así que no hace falta axios.isAxiosError aquí. No tiene sentido reintentar un 4xx.
    retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  mutations: {
    // Nunca reintentar automáticamente un create/update/delete: riesgo de doble envío.
    retry: 0,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryDefaultOptions });
}
