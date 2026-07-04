/**
 * @fileoverview DTO de query para listado de proyectos.
 *
 * Contexto:
 * - Valida paginacion, filtros y ordenacion del endpoint GET /projects.
 * - Evita lecturas masivas y ordenamientos por campos no permitidos.
 *
 * @module ListProjectsQueryDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Max,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../entities/project.entity';

const PROJECT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];
type SortOrder = 'ASC' | 'DESC';

export class ListProjectsQueryDto {
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
    description: 'Filtro por estado de proyecto.',
    enum: ProjectStatus,
  })
  @IsEnum(ProjectStatus, { message: 'Estado de filtro invalido.' })
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Filtro por identidad creadora del proyecto.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'El creatorId debe ser un UUID valido.' })
  @IsOptional()
  creatorId?: string;

  @ApiPropertyOptional({
    description: 'Busqueda parcial por titulo o contexto academico.',
  })
  @IsString({ message: 'El termino de busqueda debe ser string.' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Fecha minima de creacion (ISO 8601) para filtro por rango temporal.',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'createdFrom debe tener formato de fecha ISO 8601 valido.' },
  )
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    description:
      'Fecha maxima de creacion (ISO 8601) para filtro por rango temporal.',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsDateString(
    {},
    { message: 'createdTo debe tener formato de fecha ISO 8601 valido.' },
  )
  @IsOptional()
  createdTo?: string;

  @ApiPropertyOptional({
    description: 'Campo permitido para orden.',
    enum: PROJECT_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsIn(PROJECT_SORT_FIELDS, { message: 'Campo de orden invalido.' })
  @IsOptional()
  sortBy: ProjectSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Direccion de orden.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Direccion de orden invalida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
