/**
 * @fileoverview DTO base para queries paginadas y ordenadas.
 *
 * Contexto:
 * - Centraliza `page`, `limit` y `sortOrder`, comunes a todos los listados
 *   paginados del sistema (usuarios, proyectos, entregas, storage).
 * - Cada listado extiende esta clase y añade sus propios filtros y su whitelist
 *   de `sortBy` (que varía por dominio y no puede vivir aquí).
 *
 * @module PaginatedQueryDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type SortOrder = 'ASC' | 'DESC';

export abstract class PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Pagina solicitada.',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero.' })
  @Min(1, { message: 'La pagina minima es 1.' })
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Tamano de pagina.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero.' })
  @Min(1, { message: 'El limite minimo es 1.' })
  @Max(100, { message: 'El limite maximo es 100.' })
  @IsOptional()
  limit = 20;

  @ApiPropertyOptional({
    description: 'Direccion de orden.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Direccion de orden invalida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
