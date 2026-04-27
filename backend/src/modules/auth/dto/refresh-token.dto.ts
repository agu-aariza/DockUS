/**
 * @fileoverview DTO para solicitar un nuevo access token via refresh token.
 *
 * @module RefreshTokenDto
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'Refresh token emitido durante login o registro.',
  })
  @IsString({ message: 'El refresh token debe ser un texto.' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio.' })
  refreshToken: string;
}
