/**
 * @fileoverview Users DTOs - Contratos de Operaciones CRUD.
 *
 * ============================================================================
 * VALIDACION DE PAYLOADS DE IDENTIDAD
 * ============================================================================
 *
 * Definimos la estructura formal de los datos de entrada para la gestión de usuarios.
 * Utilizamos decoradores de `class-validator` para asegurar la integridad
 * del esquema antes de procesar las peticiones en el servicio.
 *
 * Políticas de Validación:
 * - Tipo de Roles: Valores permitidos definidos en `UserRole`.
 * - Password: Longitud mínima requerida para seguridad.
 *
 * @module UserDto
 * @requires class-validator
 * @requires @nestjs/swagger
 */

import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    example: 'admin@dockus.com',
    description: 'Email único del usuario.',
  })
  @IsEmail({}, { message: 'Formato de email inválido.' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña segura (mínimo 8 caracteres).',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @ApiProperty({
    example: 'Agustín',
    description: 'Nombre del usuario.',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  firstName: string;

  @ApiProperty({
    example: 'Ariza',
    description: 'Apellido del usuario.',
  })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  lastName: string;

  @ApiProperty({
    enum: UserRole,
    default: UserRole.STUDENT,
    description: 'Rol asignado al usuario.',
  })
  @IsEnum(UserRole, { message: 'Rol inválido especificado.' })
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    description: 'Estado inicial de la cuenta.',
  })
  @IsEnum(UserStatus, { message: 'Estado de cuenta inválido.' })
  @IsOptional()
  status?: UserStatus;
}

/**
 * DTO para la actualización parcial de identidades.
 * Heredamos las validaciones de CreateUserDto marcando todos los campos como opcionales.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
