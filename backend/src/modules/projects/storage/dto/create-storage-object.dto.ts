/**
 * @fileoverview DTO para alta de objetos de storage via multipart.
 *
 * Contexto:
 * - Define metadatos requeridos para registrar un objeto en storage.
 * - El archivo binario se transporta aparte como campo `file`.
 *
 * @module CreateStorageObjectDto
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStorageObjectDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Entrega asociada al archivo.',
  })
  @IsUUID('4', { message: 'El deliveryId debe ser un UUID valido.' })
  deliveryId: string;

  @ApiProperty({
    example: 'main.py',
    description: 'Nombre logico del archivo.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'El logicalName es obligatorio.' })
  @MaxLength(255, {
    message: 'El logicalName no puede exceder 255 caracteres.',
  })
  logicalName: string;

  @ApiProperty({
    example: 'src/main.py',
    description: 'Ruta logica relativa del archivo.',
    maxLength: 1024,
  })
  @IsString()
  @IsNotEmpty({ message: 'El logicalPath es obligatorio.' })
  @MaxLength(1024, {
    message: 'El logicalPath no puede exceder 1024 caracteres.',
  })
  logicalPath: string;

  @ApiProperty({
    example: 'text/x-python',
    description: 'Content-Type declarado para el archivo.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'El contentType es obligatorio.' })
  @MaxLength(255, {
    message: 'El contentType no puede exceder 255 caracteres.',
  })
  contentType: string;

  @ApiPropertyOptional({
    example: 2048,
    description: 'Tamano declarado del archivo en bytes (opcional).',
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt({ message: 'El sizeBytes debe ser un numero entero.' })
  @Min(0, { message: 'El sizeBytes no puede ser negativo.' })
  @IsOptional()
  sizeBytes?: number;

  @ApiProperty({
    example: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    description: 'Hash textual del archivo para trazabilidad.',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty({ message: 'El hash es obligatorio.' })
  @MaxLength(128, { message: 'El hash no puede exceder 128 caracteres.' })
  hash: string;
}
