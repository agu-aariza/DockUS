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
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { DeliveryStatus } from '../entities/delivery.entity';
import { PaginatedQueryDto } from '../../../../shared/dto/paginated-query.dto';

const DELIVERY_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'version',
  'status',
] as const;

export type DeliverySortField = (typeof DELIVERY_SORT_FIELDS)[number];

export class ListDeliveriesQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro por proyecto.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'El projectId de filtro debe ser un UUID valido.' })
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filtro por asignación.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', {
    message: 'El assignmentId de filtro debe ser un UUID valido.',
  })
  @IsOptional()
  assignmentId?: string;

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
}
