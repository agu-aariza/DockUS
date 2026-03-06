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
 * - `ADMIN`: Acceso total a operaciones de lectura, escritura y borrado físico.
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
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseUUIDPipe,
    NotFoundException,
    HttpCode,
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
import { UserRole } from './entities/user.entity';

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
     * 
     * Nota de Infraestructura:
     * Este endpoint permite la inyección de identidades con privilegios elevados.
     * Se requiere validación estricta de esquema y comprobación de RBAC (ADMIN).
     */
    @ApiOperation({
        summary: 'Aprovisionar nuevo usuario',
        description: 'Permite la creación forzada de usuarios con roles específicos (Sólo ADMIN).',
    })
    @ApiResponse({ status: 201, description: 'Usuario provisionado exitosamente.' })
    @ApiResponse({ status: 400, description: 'Error de Esquema: Los metadatos de usuario son inválidos o incompletos.' })
    @ApiResponse({ status: 401, description: 'Sesión Inválida: Token JWT ausente o corrupto.' })
    @ApiResponse({ status: 403, description: 'Infracción de Privilegios: Se requiere rol ADMIN para aprovisionar identidades.' })
    @ApiResponse({ status: 409, description: 'Conflicto de Estado: El email ya está vinculado a otra identidad.' })
    @ApiResponse({ status: 500, description: 'Fallo de Sistema: Error inesperado en el motor de persistencia.' })
    @Roles(UserRole.ADMIN)
    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.createFromDto(createUserDto);
    }

    /**
     * Recuperación del listado global de identidades.
     * 
     * Nota de Operaciones:
     * El set de datos devuelto es sanitizado para evitar la fuga de secretos (PII Leak Prevention).
     */
    @ApiOperation({
        summary: 'Listar todas las identidades',
        description: 'Recuperamos el pool completo de usuarios (Acceso ADMIN/TEACHER).',
    })
    @ApiResponse({ status: 200, description: 'Listado global recuperado con éxito.' })
    @ApiResponse({ status: 401, description: 'Acceso No Autorizado: Se requiere Bearer Token válido.' })
    @ApiResponse({ status: 403, description: 'Permisos Insuficientes: Se requiere rol ADMIN o TEACHER.' })
    @ApiResponse({ status: 500, description: 'Error Interno: Fallo en la resolución de la consulta de lectura.' })
    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    @Get()
    async findAll() {
        return this.usersService.findAll();
    }

    /**
     * Consulta de metadatos de una identidad específica.
     * 
     * Nota de Auditoría:
     * La búsqueda por UUID asegura la integridad referencial y evita enumeraciones de recursos (IDOR Protection).
     */
    @ApiOperation({
        summary: 'Consultar identidad por UUID',
        description: 'Obtenemos el perfil sanitizado de un usuario específico.',
    })
    @ApiParam({ name: 'id', description: 'UUID de la identidad.', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Identidad localizada y verificada.' })
    @ApiResponse({ status: 400, description: 'ID Malformado: El parámetro proveído no es un UUID v4 válido.' })
    @ApiResponse({ status: 401, description: 'Autenticación Requerida.' })
    @ApiResponse({ status: 403, description: 'Escalada de Privilegios Bloqueada: Nivel de acceso insuficiente.' })
    @ApiResponse({ status: 404, description: 'Recurso No Encontrado: La identidad no existe en el sistema.' })
    @ApiResponse({ status: 500, description: 'Fallo Crítico al resolver la identidad.' })
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
     * 
     * Nota de Seguridad:
     * Las contraseñas actualizadas son re-hasheadas asíncronamente antes de la persistencia.
     */
    @ApiOperation({
        summary: 'Actualizar parámetros de identidad',
        description: 'Modificamos campos específicos de un usuario (Sólo ADMIN).',
    })
    @ApiResponse({ status: 200, description: 'Identidad actualizada y persistida correctamente.' })
    @ApiResponse({ status: 400, description: 'Datos de Actualización Inválidos.' })
    @ApiResponse({ status: 401, description: 'Acceso Denegado.' })
    @ApiResponse({ status: 403, description: 'Infracción de RBAC: Se requiere rol ADMIN.' })
    @ApiResponse({ status: 404, description: 'Identidad Inexistente.' })
    @ApiResponse({ status: 409, description: 'Conflicto: El nuevo email ya está en uso.' })
    @ApiResponse({ status: 500, description: 'Error Crítico en el motor de actualización.' })
    @Roles(UserRole.ADMIN)
    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return this.usersService.update(id, updateUserDto);
    }

    /**
     * Borrado físico de una identidad en la base de datos (Operación Destructiva).
     * 
     * Advertencia DevOps:
     * Esta acción purga permanentemente el registro. Se recomienda cautela en producción.
     */
    @ApiOperation({
        summary: 'Eliminar identidad permanentemente',
        description: 'Ejecutamos el borrado físico del registro de usuario (Sólo ADMIN).',
    })
    @ApiResponse({ status: 200, description: 'Identidad purgada exitosamente.' })
    @ApiResponse({ status: 401, description: 'Sin autorización.' })
    @ApiResponse({ status: 403, description: 'Privilegios de Borrado Insuficientes (ADMIN Req).' })
    @ApiResponse({ status: 404, description: 'Identidad no localizada para borrado.' })
    @ApiResponse({ status: 500, description: 'Error al ejecutar el borrado físico.' })
    @Roles(UserRole.ADMIN)
    @Delete(':id')
    @HttpCode(200)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.remove(id);
    }
}
