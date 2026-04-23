import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CreateProjectAssignmentsBulkDto {
  @ApiProperty({
    description: 'Listado de alumnos a asignar al proyecto.',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @IsArray({ message: 'studentIds debe ser un array.' })
  @ArrayMinSize(1, { message: 'Debe indicarse al menos un alumno.' })
  @IsUUID('4', {
    each: true,
    message: 'Cada studentId debe ser un UUID válido.',
  })
  studentIds: string[];
}
