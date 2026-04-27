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
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DeliveryStatus } from '../entities/delivery.entity';

export class CreateDeliveryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Asignación proyecto-alumno a la que pertenece la entrega.',
  })
  @IsUUID('4', { message: 'El assignmentId debe ser un UUID valido.' })
  assignmentId: string;

  @ApiPropertyOptional({
    enum: DeliveryStatus,
    default: DeliveryStatus.DRAFT,
    description: 'Estado inicial opcional de la entrega.',
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

export class UpdateDeliveryGradingDto {
  @ApiPropertyOptional({
    example: 8.75,
    description: 'Nota oficial de la entrega en formato decimal.',
  })
  @IsNumber({}, { message: 'La nota debe ser un número válido.' })
  @Min(0, { message: 'La nota no puede ser inferior a 0.' })
  @Max(10, { message: 'La nota no puede ser superior a 10.' })
  @IsOptional()
  grade?: number | null;

  @ApiPropertyOptional({
    example: 'Buen trabajo general; revisa la validación de entradas.',
    description: 'Observaciones manuales del profesorado sobre la entrega.',
    maxLength: 4000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(4000, {
    message:
      'Las observaciones del corrector no pueden exceder 4000 caracteres.',
  })
  graderNotes?: string;
}
