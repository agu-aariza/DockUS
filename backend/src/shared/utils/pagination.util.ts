/**
 * @fileoverview Utilidades compartidas para paginación.
 *
 * Contexto:
 * - Centraliza el cálculo de metadatos de paginación.
 * - Evita duplicar lógica entre servicios con listados paginados.
 *
 * @module PaginationUtil
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Construye metadatos de paginación a partir de la página actual,
 * el límite por página y el total de registros.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPrevPage: totalPages > 0 && page > 1,
  };
}
