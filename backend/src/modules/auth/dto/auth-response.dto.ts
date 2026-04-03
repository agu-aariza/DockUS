/**
 * @fileoverview DTOs de respuesta para documentación Swagger.
 *
 * Contexto:
 * - Define schemas de respuesta para que Swagger muestre
 *   la estructura de datos devuelta por los endpoints de auth.
 *
 * @module AuthResponseDto
 */

import { ApiProperty } from '@nestjs/swagger';

class AuthUserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'agustin@dockus.com' })
  email: string;

  @ApiProperty({ example: 'STUDENT', enum: ['ADMIN', 'TEACHER', 'STUDENT'] })
  role: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token JWT para autenticación.',
  })
  accessToken: string;
}
