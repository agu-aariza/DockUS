/**
 * @fileoverview Utilidad de apoyo de interfaz (errors).
 *
 * @module errors
 */

import type { ApiErrorPayload } from "../types";

export function getErrorMessage(error: unknown): string {
  const payload = error as Partial<ApiErrorPayload> | undefined;
  if (!payload) {
    return 'Error desconocido.';
  }

  const status = payload.statusCode ? `[${payload.statusCode}] ` : '';
  const message = Array.isArray(payload.message)
    ? payload.message.join(' | ')
    : payload.message || payload.error || 'Error desconocido.';

  return `${status}${message}`;
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
