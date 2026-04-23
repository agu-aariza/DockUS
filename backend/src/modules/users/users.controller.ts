/**
 * @fileoverview Controlador administrativo de usuarios.
 *
 * Contexto:
 * - Expone endpoints CRUD protegidos por JWT y RBAC.
 * - Delega reglas de negocio al UsersService.
 *
 * @module UsersController
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import {
  FORBIDDEN_DESCRIPTION,
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  INVALID_INPUT_DESCRIPTION,
  INVALID_UUID_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../shared/http/http-response.constants';
import { UsersService } from './users.service';
import type { PaginatedUsersResponse } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  UserResponseDto,
  PaginatedUsersResponseDto,
} from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole, UserStatus } from './entities/user.entity';
import type { User } from './entities/user.entity';

type SanitizedUser = Omit<User, 'passwordHash'>;

const USER_ID_PARAM = {
  name: 'id',
  description: 'UUID de la identidad.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

const USER_NOT_FOUND_DESCRIPTION = 'Identidad no encontrada.';

@ApiTags('User Administration (RBAC)')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Crea un usuario desde el panel administrativo.
   */
  @ApiOperation({
    summary: 'Crear una identidad',
    description:
      'Crea una identidad con rol y estado definidos por administración.',
  })
  @ApiResponse({
    status: 201,
    description: 'Identidad creada correctamente.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_INPUT_DESCRIPTION,
  })
  @ApiResponse({
    status: 401,
    description: UNAUTHORIZED_DESCRIPTION,
  })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está reservado por otra identidad.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<SanitizedUser> {
    return this.usersService.createFromDto(createUserDto);
  }

  /**
   * Recupera el listado global de identidades.
   */
  @ApiOperation({
    summary: 'Listar identidades',
    description:
      'Devuelve el listado paginado de identidades para ADMIN y TEACHER.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de identidades recuperado correctamente.',
    type: PaginatedUsersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: UNAUTHORIZED_DESCRIPTION,
  })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponse> {
    return this.usersService.findAll(query);
  }

  /**
   * Consulta una identidad concreta por UUID.
   */
  @ApiOperation({
    summary: 'Consultar una identidad',
    description:
      'Devuelve la identidad sanitizada asociada al UUID solicitado.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Identidad recuperada correctamente.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_UUID_DESCRIPTION,
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 404,
    description: USER_NOT_FOUND_DESCRIPTION,
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SanitizedUser> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND_DESCRIPTION);
    }

    return this.usersService.sanitizeUser(user);
  }

  /**
   * Actualiza parcialmente una identidad.
   */
  @ApiOperation({
    summary: 'Actualizar una identidad',
    description: 'Actualiza parcialmente la identidad indicada.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Identidad actualizada correctamente.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_INPUT_DESCRIPTION,
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({ status: 404, description: USER_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 409,
    description: 'El email ya está reservado por otra identidad.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<SanitizedUser> {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Marca una identidad como eliminada sin borrar su registro.
   */
  @ApiOperation({
    summary: 'Eliminar una identidad',
    description: 'Aplica borrado lógico sobre la identidad indicada.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Identidad eliminada lógicamente.',
  })
  @ApiResponse({
    status: 400,
    description: INVALID_UUID_DESCRIPTION,
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 404,
    description: USER_NOT_FOUND_DESCRIPTION,
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }

  /**
   * Restaura una identidad eliminada lógicamente.
   */
  @ApiOperation({
    summary: 'Restaurar una identidad',
    description:
      'Recupera una identidad eliminada previamente mediante soft delete.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Identidad restaurada correctamente.',
  })
  @ApiResponse({
    status: 400,
    description: INVALID_UUID_DESCRIPTION,
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 404,
    description: 'Identidad eliminada no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'La identidad ya se encuentra activa.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SanitizedUser> {
    return this.usersService.restore(id);
  }

  /**
   * Actualiza el estado del ciclo de vida de la cuenta.
   */
  @ApiOperation({
    summary: 'Actualizar el estado de una identidad',
    description: 'Cambia el estado operativo de la identidad indicada.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiParam({
    name: 'status',
    enum: UserStatus,
    description: 'Nuevo estado objetivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la identidad actualizado correctamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'El UUID o el estado proporcionado no son válidos.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({
    status: 403,
    description: FORBIDDEN_DESCRIPTION,
  })
  @ApiResponse({
    status: 404,
    description: USER_NOT_FOUND_DESCRIPTION,
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/status/:status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ): Promise<SanitizedUser> {
    return this.usersService.updateStatus(id, status);
  }
}
