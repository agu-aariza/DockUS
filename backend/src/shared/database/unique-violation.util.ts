/**
 * @fileoverview Utilidad para transformar violaciones de unicidad PostgreSQL.
 *
 * Contexto:
 * - Centraliza la detección de conflictos de clave única (código 23505).
 * - Traduce errores de driver a excepciones HTTP de dominio.
 *
 * @module UniqueViolationUtil
 */

import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Inspecciona un error de TypeORM y lanza ConflictException si es
 * una violación de restricción UNIQUE de PostgreSQL (código 23505).
 *
 * Si el error no es una violación de unicidad, lo relanza tal cual.
 */
export function throwIfUniqueViolation(
  error: unknown,
  conflictMessage: string,
): never {
  const isUniqueViolation =
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code === '23505';

  if (isUniqueViolation) {
    throw new ConflictException(conflictMessage);
  }

  throw error;
}
