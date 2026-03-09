/**
 * @fileoverview Users Controller - Gestión Administrativa de Identidades.
 *
 * ============================================================================
 * ENDPOINTS DE ADMINISTRACION Y RBAC
 * ============================================================================
 *
 * Proporcionamos los puntos de entrada para la gestión delegada de usuarios.
 * Estos endpoints están protegidos por una doble capa de seguridad:
 * 1. Autenticación Stateless (JWT).
 * 2. Autorización por Roles (RolesGuard).
 *
 * Políticas de Acceso:
 * - `ADMIN`: Acceso total a operaciones de lectura, escritura y borrado lógico.
 * - `TEACHER`: Acceso limitado a operaciones de consulta (Read-only).
 * - `STUDENT`: Acceso denegado a este controlador. La gestión de perfil propio
 *   se realiza a través del AuthModule.
 *
 * @module UsersController
 * @requires @nestjs/common
 * @requires @nestjs/swagger
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Patch,
  Param,
  Delete,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole, UserStatus } from './entities/user.entity';

@ApiTags('User Administration (RBAC)')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  /**
   * Inyectamos el servicio de lógica de negocio de usuarios.
   * @param {UsersService} usersService - Gestor de identidades.
   */
  constructor(private readonly usersService: UsersService) { }

  /**
   * Punto de aprovisionamiento directo de usuarios (Uso Administrativo).
   * Requiere validación estricta de esquema y privilegios elevados (ADMIN).
   */
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Permite la creación forzada de usuarios con roles específicos (Sólo ADMIN).',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de Esquema.',
  })
  @ApiResponse({
    status: 401,
    description: 'Sesión Inválida.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Infracción de Privilegios.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto de Estado: El email ya está vinculado a otra identidad.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Fallo de Sistema',
  })
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createFromDto(createUserDto);
  }

  /**
   * Recuperación del listado global de identidades.
   * El set de datos devuelto es sanitizado para evitar la fuga de secretos (PII Leak Prevention).
   */
  @ApiOperation({
    summary: 'Listar todas las identidades',
    description:
      'Recuperamos el pool de usuarios en formato de listado plano (Sólo ADMIN/TEACHER).',
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
    description:
      'Error Interno',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  /**
   * Consulta de metadatos de una identidad específica mediante UUID.
   * La búsqueda por UUID asegura la integridad referencial y protege contra IDOR.
   */
  @ApiOperation({
    summary: 'Consultar identidad por UUID',
    description: 'Obtenemos el perfil sanitizado de un usuario específico (Sólo ADMIN/TEACHER).',
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
    description:
      'ID Malformado',
  })
  @ApiResponse({ status: 401, description: 'Autenticación Requerida.' })
  @ApiResponse({
    status: 403,
    description:
      'Escalada de Privilegios Bloqueada.',
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
   * Mutación parcial de datos de identidad (Write-Only Admin).
   * Las contraseñas son re-hasheadas asíncronamente antes de la persistencia.
   */
  @ApiOperation({
    summary: 'Actualizar parámetros de identidad',
    description: 'Modificamos campos específicos de un usuario (Sólo ADMIN).',
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
   * Borrado lógico de una identidad (Soft Delete).
   * Esta acción no purga el registro, sino que lo marca mediante `deletedAt`.
   */
  @ApiOperation({
    summary: 'Eliminar identidad lógicamente',
    description:
      'Ejecutamos el marcado de borrado lógico del usuario (Sólo ADMIN).',
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
   * Restauración de una identidad eliminada lógicamente.
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
   * Gestión del estado del ciclo de vida de la cuenta.
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



