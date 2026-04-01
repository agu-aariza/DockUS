/**
 * @fileoverview Controlador para gestion de objetos de storage.
 *
 * Contexto:
 * - Expone upload, consulta, signed URLs y ciclo de vida de metadatos.
 * - Aplica JWT + RBAC y delega ownership al servicio.
 *
 * @module StorageController
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  FORBIDDEN_DESCRIPTION,
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  INVALID_INPUT_DESCRIPTION,
  INVALID_UUID_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { CreateStorageObjectDto } from './dto/create-storage-object.dto';
import { ListStorageObjectsQueryDto } from './dto/list-storage-objects-query.dto';
import {
  CreateDownloadUrlResponse,
  PaginatedStorageResponse,
  StorageObjectResponse,
  StorageService,
} from './storage.service';
import { UploadedStorageFile } from './interfaces/uploaded-storage-file.interface';

const STORAGE_OBJECT_ID_PARAM = {
  name: 'id',
  description: 'UUID del objeto de storage.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @ApiOperation({
    summary: 'Subir objeto a storage',
    description:
      'Sube archivo via multipart al backend y persiste metadata en BD.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'deliveryId',
        'logicalName',
        'logicalPath',
        'contentType',
        'hash',
        'file',
      ],
      properties: {
        deliveryId: { type: 'string', format: 'uuid' },
        logicalName: { type: 'string' },
        logicalPath: { type: 'string' },
        contentType: { type: 'string' },
        sizeBytes: { type: 'integer' },
        hash: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Objeto de storage subido correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() dto: CreateStorageObjectDto,
    @UploadedFile() file: UploadedStorageFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.upload(dto, file, request.user);
  }

  @ApiOperation({
    summary: 'Listar objetos de storage',
    description: 'Lista objetos con paginacion y filtros funcionales.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de objetos recuperado correctamente.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  async findAll(
    @Query() query: ListStorageObjectsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedStorageResponse> {
    return this.storageService.findAll(query, request.user);
  }

  @ApiOperation({
    summary: 'Consultar objeto de storage',
    description: 'Recupera metadata de un objeto por UUID.',
  })
  @ApiParam(STORAGE_OBJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Objeto de storage recuperado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Objeto de storage no encontrado.' })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.findOne(id, request.user);
  }

  @ApiOperation({
    summary: 'Generar signed URL de descarga',
    description: 'Genera URL temporal para descarga directa desde storage.',
  })
  @ApiParam(STORAGE_OBJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Signed URL generada correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Objeto de storage no encontrado.' })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post(':id/download-url')
  async createDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateDownloadUrlResponse> {
    return this.storageService.createDownloadUrl(id, request.user);
  }

  @ApiOperation({
    summary: 'Eliminar objeto (soft delete)',
    description:
      'Elimina lógicamente la metadata; no purga el objeto físico en storage.',
  })
  @ApiParam(STORAGE_OBJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Objeto marcado como eliminado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Objeto de storage no encontrado.' })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.storageService.remove(id, request.user);
  }

  @ApiOperation({
    summary: 'Purgar objeto fisicamente',
    description:
      'Elimina metadata y objeto físico de storage. Operación solo ADMIN.',
  })
  @ApiParam(STORAGE_OBJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Objeto purgado fisicamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Objeto de storage no encontrado.' })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Delete(':id/purge')
  async purge(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.storageService.purge(id, request.user);
  }

  @ApiOperation({
    summary: 'Restaurar objeto soft-deleted',
    description:
      'Restaura metadata eliminada lógicamente si el objeto físico existe.',
  })
  @ApiParam(STORAGE_OBJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Objeto restaurado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: 'Objeto de storage no encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'El objeto ya se encuentra activo.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.restore(id, request.user);
  }
}
