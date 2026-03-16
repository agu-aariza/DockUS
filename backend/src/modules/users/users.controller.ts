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
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole, UserStatus } from './entities/user.entity';

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
    summary: 'Crear nuevo usuario',
    description:
      'Crea un usuario con rol y estado definidos por administración.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de Esquema.',
  })
  @ApiResponse({
    status: 401,
    description: 'Sesión Inválida.',
  })
  @ApiResponse({
    status: 403,
    description: 'Infracción de Privilegios.',
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está reservado por otra identidad.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor.',
  })
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createFromDto(createUserDto);
  }

  /**
   * Recupera el listado global de identidades.
   */
  @ApiOperation({
    summary: 'Listar todas las identidades',
    description:
      'Devuelve usuarios paginados y filtrables para ADMIN y TEACHER.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado global recuperado con éxito.',
  })
  @ApiResponse({
    status: 401,
    description: 'Acceso No Autorizado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Permisos Insuficientes.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error Interno',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  /**
   * Consulta una identidad concreta por UUID.
   */
  @ApiOperation({
    summary: 'Consultar identidad por UUID',
    description: 'Devuelve el perfil sanitizado de un usuario concreto.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la identidad.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad localizada y verificada.',
  })
  @ApiResponse({
    status: 400,
    description: 'ID Malformado',
  })
  @ApiResponse({ status: 401, description: 'Autenticación Requerida.' })
  @ApiResponse({
    status: 403,
    description: 'Escalada de Privilegios Bloqueada.',
  })
  @ApiResponse({
    status: 404,
    description: 'Recurso No Encontrado.',
  })
  @ApiResponse({
    status: 500,
    description: 'Fallo Crítico al resolver la identidad.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('Identidad no localizada en el sistema.');
    }
    return this.usersService.sanitizeUser(user);
  }

  /**
   * Actualiza parcialmente una identidad.
   */
  @ApiOperation({
    summary: 'Actualizar parámetros de identidad',
    description: 'Modifica campos concretos de un usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad actualizada y persistida correctamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de Actualización Inválidos.',
  })
  @ApiResponse({ status: 401, description: 'Acceso Denegado.' })
  @ApiResponse({
    status: 403,
    description: 'Infracción de RBAC.',
  })
  @ApiResponse({ status: 404, description: 'Identidad Inexistente.' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: El nuevo email ya está en uso.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error Crítico en el motor de actualización.',
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Marca una identidad como eliminada sin borrar su registro.
   */
  @ApiOperation({
    summary: 'Eliminar identidad lógicamente',
    description: 'Marca el usuario como eliminado mediante soft delete.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad marcada como eliminada exitosamente.',
  })
  @ApiResponse({ status: 401, description: 'Sin autorización.' })
  @ApiResponse({
    status: 403,
    description: 'Privilegios Insuficientes.',
  })
  @ApiResponse({
    status: 404,
    description: 'Identidad no localizada para borrado.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error al ejecutar el borrado lógico.',
  })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  /**
   * Restaura una identidad eliminada lógicamente.
   */
  @ApiOperation({
    summary: 'Restaurar identidad eliminada',
    description:
      'Recuperamos un registro que fue marcado previamente con Soft Delete (Sólo ADMIN).',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad restaurada y operativa.',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró una identidad eliminada con ese UUID.',
  })
  @ApiResponse({
    status: 409,
    description: 'La identidad ya se encuentra en estado activo.',
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.restore(id);
  }

  /**
   * Actualiza el estado del ciclo de vida de la cuenta.
   */
  @ApiOperation({
    summary: 'Actualizar estado de la cuenta',
    description:
      'Permite suspender, activar o marcar cuentas como inactivas proactivamente (Sólo ADMIN).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la identidad.' })
  @ApiParam({
    name: 'status',
    enum: UserStatus,
    description: 'Nuevo estado objetivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado correctamente.',
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/status/:status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ) {
    return this.usersService.updateStatus(id, status);
  }
}
