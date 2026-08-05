/**
 * @fileoverview DTOs de respuesta para documentación Swagger de usuarios.
 *
 * Contexto:
 * - Define schemas de respuesta para que Swagger muestre
 *   la estructura de datos devuelta por los endpoints de users.
 *
 * @module UserResponseDto
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'agustin@educodeai.com' })
  email: string;

  @ApiProperty({ example: 'Agustín' })
  firstName: string;

  @ApiProperty({ example: 'Ariza' })
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: '2026-03-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-01T12:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;
}

class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPrevPage: boolean;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
