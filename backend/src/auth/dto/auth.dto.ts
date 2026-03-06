/**
 * @fileoverview Auth DTOs - Contratos de Frontera para IAM.
 * 
 * ============================================================================
 * VALIDACION Y SANEAMIENTO DE PAYLOADS
 * ============================================================================
 * 
 * Definimos la estructura restrictiva permitida en los firewalls lógicos
 * (ValidationPipes) antes de tocar capas internas de la aplicación.
 * 
 * Políticas Implementadas:
 * - DTOs estrictos por verbo (Register/Login).
 * - "Fail-Fast" de NestJS: Rechazamos la petición sin cómputo extra si `class-validator`
 *   falla. Mitigamos DoS y validaciones costosas.
 * - Minimum Security baselines (Longitudes mínimas forzadas).
 * 
 * @module AuthDto
 * @requires class-validator
 * @requires @nestjs/swagger
 */

import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  /**
   * Primary key lógica (Unique Identity Payload).
   */
  @ApiProperty({
    example: 'agustin@dockus.com',
    description: 'Vector unívoco para resolución de identidad.',
  })
  @IsEmail({}, { message: 'Error de parseo durante sanitización del Payload.' })
  email: string;

  /**
   * Secret Key proporcionado por el usuario. 
   * Políticas Zero-Trust nos obligan a rechazar secretos débiles (Entropía base).
   */
  @ApiProperty({
    example: '12345678!',
    description: 'Secret Key (Min: 8 caracteres para mitigación de BF).',
    minLength: 8,
  })
  @IsString({ message: 'El tipo debe coincidir estrictamente.' })
  @MinLength(8, { message: 'Infracción política seguridad: Longitud de password insana.' })
  password: string;

  @ApiProperty({
    example: 'Agustin',
    description: 'Nombre referencial (Metadato no estructurado).',
  })
  @IsString({ message: 'Tipo MIME inválido procesando el string.' })
  @IsNotEmpty({ message: 'Ausencia de datos críticos requeridos: Nombre.' })
  firstName: string;

  @ApiProperty({
    example: 'Ariza',
    description: 'Metadata referencial.',
  })
  @IsString({ message: 'Tipo MIME inválido procesando el string.' })
  @IsNotEmpty({ message: 'Ausencia de datos críticos requeridos: Apellido.' })
  lastName: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'agustin@dockus.com',
    description: 'Account Resolver.',
  })
  @IsEmail({}, { message: 'Error de parseo durante sanitización del Payload.' })
  email: string;

  /**
   * Nota Operacional de SOC: A diferencia del DTO de registro,
   * no validamos `MinLength` explícitamente en el inicio de sesión
   * para evitar Enumeración de Políticas Críticas ante agentes maliciosos.
   */
  @ApiProperty({
    example: '12345678!',
    description: 'Acceso Secreto. Validación ofuscada por defecto.',
  })
  @IsString({ message: 'Tipo MIME inválido procesando el string.' })
  password: string;
} 
