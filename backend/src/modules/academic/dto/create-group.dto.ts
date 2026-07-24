/**
 * @fileoverview Módulo académico de grupos y matrículas (create-group.dto).
 *
 * @module create-group.dto
 */

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
