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
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { UserRole, UserStatus } from '../entities/user.entity';

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
type SortOrder = 'ASC' | 'DESC';

/** DTO de querystring para listado paginado de usuarios. */
export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Pagina solicitada.',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero.' })
  @Min(1, { message: 'La pagina minima es 1.' })
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Tamano de pagina.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero.' })
  @Min(1, { message: 'El limite minimo es 1.' })
  @Max(100, { message: 'El limite maximo es 100.' })
  @IsOptional()
  limit = 20;

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

  @ApiPropertyOptional({
    description: 'Direccion de orden.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsIn(['ASC', 'DESC'], { message: 'Direccion de orden invalida.' })
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
