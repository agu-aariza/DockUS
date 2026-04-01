/**
 * @fileoverview DTOs para creacion y actualizacion de entregas.
 *
 * Contexto:
 * - Define validaciones de entrada para el ciclo de vida de entregas.
 * - Estandariza versionado y estado funcional de evaluacion.
 *
 * @module DeliveryDto
 */

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DeliveryStatus } from '../entities/delivery.entity';

export class CreateDeliveryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Proyecto al que pertenece la entrega.',
  })
  @IsUUID('4', { message: 'El projectId debe ser un UUID valido.' })
  projectId: string;

  @ApiProperty({
    example: 1,
    description: 'Version logica de la entrega dentro del proyecto.',
    minimum: 1,
  })
  @IsInt({ message: 'La version debe ser un numero entero.' })
  @Min(1, { message: 'La version minima permitida es 1.' })
  version: number;

  @ApiPropertyOptional({
    enum: DeliveryStatus,
    default: DeliveryStatus.DRAFT,
    description: 'Estado inicial de la entrega.',
  })
  @IsEnum(DeliveryStatus, { message: 'Estado de entrega invalido.' })
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    example: 'Entrega inicial con estructura base del proyecto.',
    description: 'Observaciones opcionales para la entrega.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Las observaciones no pueden estar vacias.' })
  @IsOptional()
  @MaxLength(2000, {
    message: 'Las observaciones no pueden exceder 2000 caracteres.',
  })
  notes?: string;
}

/**
 * DTO para actualizacion parcial de entregas.
 */
export class UpdateDeliveryDto extends PartialType(CreateDeliveryDto) {}
