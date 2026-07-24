/**
 * @fileoverview Módulo de proyectos académicos y entregas (create-project-assignment.dto).
 *
 * @module create-project-assignment.dto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateProjectAssignmentsBulkDto {
  @ApiPropertyOptional({
    description: 'Listado de alumnos a asignar al proyecto.',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @Transform(({ value }) =>
    Array.isArray(value) && value.length === 0 ? undefined : value,
  )
  @IsArray({ message: 'studentIds debe ser un array.' })
  @ArrayMinSize(1, {
    message: 'Debe indicarse al menos un alumno cuando se envían studentIds.',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada studentId debe ser un UUID válido.',
  })
  @IsOptional()
  studentIds?: string[];

  @ApiPropertyOptional({
    description:
      'Listado de correos de alumnos a asignar al proyecto, útil para importación CSV.',
    example: ['alumno1@dockus.test', 'alumno2@dockus.test'],
    type: [String],
  })
  @Transform(({ value }) =>
    Array.isArray(value) && value.length === 0 ? undefined : value,
  )
  @IsArray({ message: 'studentEmails debe ser un array.' })
  @ArrayMinSize(1, {
    message:
      'Debe indicarse al menos un alumno cuando se envían studentEmails.',
  })
  @IsEmail(
    {},
    {
      each: true,
      message: 'Cada studentEmail debe ser un correo válido.',
    },
  )
  @IsOptional()
  studentEmails?: string[];

  @ApiPropertyOptional({
    description:
      'Listado de grupos docentes cuyos alumnos se asignarán al proyecto.',
    example: [
      '550e8400-e29b-41d4-a716-446655440010',
      '550e8400-e29b-41d4-a716-446655440011',
    ],
    type: [String],
  })
  @Transform(({ value }) =>
    Array.isArray(value) && value.length === 0 ? undefined : value,
  )
  @IsArray({ message: 'groupIds debe ser un array.' })
  @ArrayMinSize(1, {
    message: 'Debe indicarse al menos un grupo cuando se envían groupIds.',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada groupId debe ser un UUID válido.',
  })
  @IsOptional()
  groupIds?: string[];

  @ApiPropertyOptional({
    description: 'Entrada de texto libre para procesar correos electrónicos.',
    type: String,
  })
  @IsString()
  @IsOptional()
  rawInput?: string;
}
