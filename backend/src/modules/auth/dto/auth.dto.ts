/**
 * @fileoverview DTOs para operaciones de autenticación.
 *
 * Contexto:
 * - Define contratos de entrada para register y login.
 * - Aplica validaciones con class-validator y metadatos Swagger.
 *
 * @module AuthDto
 */

import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'agustin@educodeai.com',
    description: 'Correo electrónico de acceso.',
  })
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido.' })
  email: string;

  @ApiProperty({
    example: '12345678!',
    description: 'Contraseña de la cuenta.',
    minLength: 8,
  })
  @IsString({ message: 'La contraseña debe ser un texto.' })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres.',
  })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número o carácter especial.',
  })
  password: string;

  @ApiProperty({
    example: 'Agustin',
    description: 'Nombre.',
  })
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  firstName: string;

  @ApiProperty({
    example: 'Ariza',
    description: 'Apellido.',
  })
  @IsString({ message: 'El apellido debe ser un texto.' })
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  lastName: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'agustin@educodeai.com',
    description: 'Correo electrónico de acceso.',
  })
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido.' })
  email: string;

  @ApiProperty({
    example: '12345678!',
    description: 'Contraseña de la cuenta.',
    minLength: 8,
  })
  @IsString({ message: 'La contraseña debe ser un texto.' })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres.',
  })
  password: string;
}
