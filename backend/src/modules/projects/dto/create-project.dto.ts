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
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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
}

/**
 * DTO para actualizacion parcial de proyecto.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
