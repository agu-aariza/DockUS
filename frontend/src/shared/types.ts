/**
 * @fileoverview Módulo de la interfaz de usuario (types).
 *
 * @module types
 */

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface ApiErrorPayload {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}
