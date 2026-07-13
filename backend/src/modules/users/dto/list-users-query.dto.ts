/**
 * @fileoverview DTO de query para listado de usuarios.
 *
 * Contexto:
 * - Valida paginación, filtros y ordenamiento de GET /users.
 * - Evita parámetros no permitidos o lecturas masivas sin control.
 *
 * @module ListUsersQueryDto
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole, UserStatus } from '../entities/user.entity';
import { PaginatedQueryDto } from '../../../shared/dto/paginated-query.dto';

/** Whitelist de columnas permitidas para ordenamiento seguro desde querystring. */
const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'role',
  'status',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** DTO de querystring para listado paginado de usuarios. */
export class ListUsersQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro por rol.',
    enum: UserRole,
  })
  @IsEnum(UserRole, { message: 'Rol de filtro invalido.' })
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filtro por estado.',
    enum: UserStatus,
  })
  @IsEnum(UserStatus, { message: 'Estado de filtro invalido.' })
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Busqueda parcial por email, nombre o apellido.',
  })
  @IsString({ message: 'El termino de busqueda debe ser string.' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Campo permitido para orden.',
    enum: USER_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsIn(USER_SORT_FIELDS, { message: 'Campo de orden invalido.' })
  @IsOptional()
  sortBy: UserSortField = 'createdAt';
}
