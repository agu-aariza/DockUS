/**
 * @fileoverview Controlador de la suite de pruebas docente de un proyecto.
 *
 * Contexto:
 * - Sub-recurso `projects/:id/test-suite`. Se separó de `ProjectsController`
 *   porque es una responsabilidad de almacenamiento (delega en `StorageService`),
 *   no de CRUD de proyectos, y para acotar la superficie de aquel controlador.
 * - Su ruta tiene un segmento propio (`/test-suite`), por lo que no colisiona
 *   con `projects/:id`.
 *
 * @module ProjectTestSuiteController
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import {
  StorageObjectResponse,
  StorageService,
} from '../storage/storage.service';
import { UploadedStorageFile } from '../storage/interfaces/uploaded-storage-file.interface';

const PROJECT_ID_PARAM = {
  name: 'id',
  description: 'UUID del proyecto.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects/:id/test-suite')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectTestSuiteController {
  constructor(private readonly storageService: StorageService) {}

  @ApiOperation({ summary: 'Subir suite docente (ZIP)' })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedStorageFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.uploadProjectTestSuite(id, file, request.user);
  }

  @ApiOperation({ summary: 'Consultar suite docente activa' })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  async findTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.findProjectTestSuite(id, request.user);
  }

  @ApiOperation({
    summary: 'Previsualizar contenido de la suite docente (solo ZIP)',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get('preview')
  async previewTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Array<{ path: string; content: string }>> {
    return this.storageService.previewProjectTestSuite(id, request.user);
  }

  @ApiOperation({ summary: 'Eliminar suite docente activa' })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete()
  async removeTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.storageService.removeProjectTestSuite(id, request.user);
  }
}
