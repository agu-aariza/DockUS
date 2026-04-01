/**
 * @fileoverview DTO de query para listado de entregas.
 *
 * Contexto:
 * - Valida paginacion y filtros funcionales del endpoint GET /deliveries.
 * - Restringe ordenacion a campos seguros del dominio.
 *
 * @module ListDeliveriesQueryDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DeliveryStatus } from '../entities/delivery.entity';

const DELIVERY_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'version',
  'status',
] as const;

export type DeliverySortField = (typeof DELIVERY_SORT_FIELDS)[number];
export type SortOrder = 'ASC' | 'DESC';

export class ListDeliveriesQueryDto {
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
    description: 'Filtro por proyecto.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'El projectId de filtro debe ser un UUID valido.' })
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filtro por autor de entrega.',
    example: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
  })
  @IsUUID('4', { message: 'El authorId de filtro debe ser un UUID valido.' })
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Filtro por estado funcional.',
    enum: DeliveryStatus,
  })
  @IsEnum(DeliveryStatus, { message: 'Estado de filtro invalido.' })
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Campo permitido para orden.',
    enum: DELIVERY_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsIn(DELIVERY_SORT_FIELDS, { message: 'Campo de orden invalido.' })
  @IsOptional()
  sortBy: DeliverySortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Direccion de orden.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Direccion de orden invalida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
