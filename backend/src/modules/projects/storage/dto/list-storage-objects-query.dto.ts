/**
 * @fileoverview DTO de query para listado de objetos de storage.
 *
 * Contexto:
 * - Valida paginacion, filtros y ordenacion de GET /storage.
 * - Evita ordenes por columnas no permitidas.
 *
 * @module ListStorageObjectsQueryDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const STORAGE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'logicalName',
  'sizeBytes',
] as const;

export type StorageSortField = (typeof STORAGE_SORT_FIELDS)[number];
export type SortOrder = 'ASC' | 'DESC';

export class ListStorageObjectsQueryDto {
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
    description: 'Filtro por entrega.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'El deliveryId debe ser un UUID valido.' })
  @IsOptional()
  deliveryId?: string;

  @ApiPropertyOptional({
    description: 'Filtro por uploader.',
    example: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  })
  @IsUUID('4', { message: 'El uploaderId debe ser un UUID valido.' })
  @IsOptional()
  uploaderId?: string;

  @ApiPropertyOptional({
    description: 'Fecha minima de creacion (ISO 8601).',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'createdFrom debe tener formato ISO 8601 valido.' },
  )
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha maxima de creacion (ISO 8601).',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsDateString(
    {},
    { message: 'createdTo debe tener formato ISO 8601 valido.' },
  )
  @IsOptional()
  createdTo?: string;

  @ApiPropertyOptional({
    description: 'Campo permitido para orden.',
    enum: STORAGE_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsIn(STORAGE_SORT_FIELDS, { message: 'Campo de orden invalido.' })
  @IsOptional()
  sortBy: StorageSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Direccion de orden.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Direccion de orden invalida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
