/**
 * @fileoverview DTOs para creación y actualización de usuarios.
 *
 * Contexto:
 * - Define validaciones de campos para operaciones de usuario.
 * - Restringe tipos permitidos y reglas de integridad.
 *
 * @module UserDto
 */

import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
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
    example: 'Password123!',
    description:
      'Contraseña segura (mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial).',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número o carácter especial.',
  })
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
