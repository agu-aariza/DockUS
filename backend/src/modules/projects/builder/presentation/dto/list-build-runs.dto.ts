/**
 * @fileoverview DTO de query para listado paginado de BuildRuns.
 *
 * Contexto:
 * - Valida parámetros de paginación/filtro para historial de runs.
 * - Mantiene consistencia de contrato con otros listados del backend.
 *
 * @module ListBuildRunsDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';

export type SortOrder = 'ASC' | 'DESC';

export class ListBuildRunsDto {
  @ApiPropertyOptional({
    description: 'Página solicitada.',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página mínima es 1.' })
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Tamaño de página.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite mínimo es 1.' })
  @Max(100, { message: 'El límite máximo es 100.' })
  @IsOptional()
  limit = 20;

  @ApiPropertyOptional({
    description: 'Filtro por estado de ejecución.',
    enum: BuildRunStatus,
  })
  @IsEnum(BuildRunStatus, { message: 'Estado de filtro inválido.' })
  @IsOptional()
  status?: BuildRunStatus;

  @ApiPropertyOptional({
    description: 'Orden por fecha de creación.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Dirección de orden inválida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
