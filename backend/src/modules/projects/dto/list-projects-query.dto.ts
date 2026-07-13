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
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ProjectStatus } from '../entities/project.entity';
import { PaginatedQueryDto } from '../../../shared/dto/paginated-query.dto';

const PROJECT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export class ListProjectsQueryDto extends PaginatedQueryDto {
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
}
