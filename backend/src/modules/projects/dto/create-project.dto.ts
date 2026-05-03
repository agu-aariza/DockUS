/**
 * @fileoverview DTOs para creacion y actualizacion de proyectos.
 *
 * Contexto:
 * - Define validaciones de entrada para operaciones CRUD de proyectos.
 * - Restringe tamano y formato para evitar ruido en persistencia.
 *
 * @module ProjectDto
 */

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus } from '../entities/project.entity';

export class CreateProjectDto {
  @ApiProperty({
    example: 'Analizador de calidad Python - Convocatoria Ordinaria',
    description: 'Titulo funcional del proyecto academico.',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'El titulo del proyecto es obligatorio.' })
  @MaxLength(200, { message: 'El titulo no puede exceder 200 caracteres.' })
  title: string;

  @ApiPropertyOptional({
    example: 'MPSP 2025/2026 - Grupo A',
    description: 'Contexto academico para trazabilidad docente.',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000, {
    message: 'El contexto academico no puede exceder 1000 caracteres.',
  })
  contextAcademico?: string;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
    description: 'Estado funcional inicial del proyecto.',
  })
  @IsEnum(ProjectStatus, { message: 'Estado de proyecto invalido.' })
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({
    example: 2,
    description: 'Máximo de entregas permitidas por alumno asignado.',
    minimum: 1,
    default: 1,
  })
  @IsInt({ message: 'El máximo de entregas debe ser un entero.' })
  @Min(1, { message: 'El máximo de entregas por alumno debe ser al menos 1.' })
  @IsOptional()
  maxDeliveriesPerStudent?: number;

  @ApiPropertyOptional({
    example: 'Web API con FastAPI',
    description: 'Tipo de proyecto esperado para validación por LLM.',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  expectedType?: string;

  @ApiPropertyOptional({
    example: 'Usa async/await y valida que los modelos usen Pydantic v2.',
    description:
      'Instrucciones detalladas de la rúbrica para el evaluador LLM.',
  })
  @IsString()
  @IsOptional()
  rubricInstructions?: string;

  @ApiPropertyOptional({
    example: '2026-05-10T08:00:00.000Z',
    description: 'Momento de apertura del plazo de entregas.',
  })
  @IsDateString({}, { message: 'opensAt debe ser una fecha ISO válida.' })
  @IsOptional()
  opensAt?: string;

  @ApiPropertyOptional({
    example: '2026-05-24T23:59:59.000Z',
    description:
      'Momento a partir del que las entregas pasan a considerarse tardías.',
  })
  @IsDateString({}, { message: 'closesAt debe ser una fecha ISO válida.' })
  @IsOptional()
  closesAt?: string;

  @ApiPropertyOptional({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'IDs de grupos academicos a los que asignar el proyecto al crearlo.',
    type: [String],
  })
  @IsString({ each: true })
  @IsOptional()
  assignedGroupIds?: string[];
}

/**
 * DTO para actualizacion parcial de proyecto.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
