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
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus } from '../entities/project.entity';

/**
 * Criterio ponderado de una rúbrica. El peso es un porcentaje entero (0-100).
 */
export class RubricCriterionDto {
  @ApiProperty({
    example: 'Correctitud del algoritmo',
    description: 'Nombre del criterio de evaluación.',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del criterio es obligatorio.' })
  @MaxLength(120, {
    message: 'El nombre del criterio no puede exceder 120 caracteres.',
  })
  name: string;

  @ApiProperty({
    example: 50,
    description: 'Peso del criterio en porcentaje (0-100).',
    minimum: 0,
    maximum: 100,
  })
  @IsInt({ message: 'El peso del criterio debe ser un entero.' })
  @Min(0, { message: 'El peso del criterio no puede ser negativo.' })
  @Max(100, { message: 'El peso del criterio no puede exceder 100.' })
  weight: number;

  @ApiPropertyOptional({
    example: 'La salida coincide con el oráculo para todas las entradas.',
    description: 'Guía opcional de qué evaluar en este criterio.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: 'La descripción del criterio no puede exceder 500 caracteres.',
  })
  description?: string;
}

/**
 * Valida que los pesos de los criterios de la rúbrica sumen exactamente 100.
 * Se omite la validación cuando no se aporta ningún criterio (rúbrica opcional).
 */
@ValidatorConstraint({ name: 'rubricWeightsSumTo100', async: false })
export class RubricWeightsSumTo100Constraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    if (!Array.isArray(value) || value.length === 0) {
      return true;
    }
    const total = value.reduce((sum, criterion) => {
      const weight = (criterion as RubricCriterionDto)?.weight;
      return sum + (typeof weight === 'number' ? weight : 0);
    }, 0);
    return total === 100;
  }

  defaultMessage(): string {
    return 'Los pesos de los criterios de la rúbrica deben sumar 100.';
  }
}

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
  @MaxLength(8000, {
    message: 'Las instrucciones de rúbrica no pueden exceder 8000 caracteres.',
  })
  rubricInstructions?: string;

  @ApiPropertyOptional({
    type: [RubricCriterionDto],
    description:
      'Criterios de rúbrica ponderados. Los pesos son porcentajes que deben sumar 100.',
    example: [
      { name: 'Correctitud', weight: 60, description: 'La salida coincide.' },
      {
        name: 'Calidad de código',
        weight: 40,
        description: 'Legible y modular.',
      },
    ],
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20, {
    message: 'No se pueden definir más de 20 criterios de rúbrica.',
  })
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  @Validate(RubricWeightsSumTo100Constraint)
  rubricCriteria?: RubricCriterionDto[];

  @ApiPropertyOptional({
    example: 'Hola Mundo',
    description: 'Salida esperada del programa para validación automática.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(4000, {
    message: 'La salida esperada no puede exceder 4000 caracteres.',
  })
  expectedOutput?: string;

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
    description:
      'IDs de grupos academicos a los que asignar el proyecto al crearlo.',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200, {
    message: 'No se pueden asignar más de 200 grupos a la vez.',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada grupo asignado debe identificarse con un UUID válido.',
  })
  @IsOptional()
  assignedGroupIds?: string[];
}

/**
 * DTO para actualizacion parcial de proyecto.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
