/**
 * @fileoverview Controlador de gestion funcional de proyectos.
 *
 * Contexto:
 * - Expone endpoints CRUD con JWT + RBAC.
 * - Delega reglas de negocio al servicio de proyectos.
 *
 * @module ProjectsController
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseEnumPipe,
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
import type { Response } from 'express';
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
import { CreateProjectDto, UpdateProjectDto } from '../dto/create-project.dto';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto';
import { ReconcileOperationalIssuesDto } from '../dto/reconcile-operational-issues.dto';
import { Project, ProjectStatus } from '../entities/project.entity';
import {
  ProjectOperationalIssuesReconcileResult,
  PaginatedProjectsResponse,
  ProjectOperationalIssuesSummary,
  ProjectsService,
} from '../projects.service';
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

const PROJECT_NOT_FOUND_DESCRIPTION = 'Proyecto no encontrado.';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly storageService: StorageService,
  ) {}

  @ApiOperation({
    summary: 'Consultar estado del runtime (efímero)',
    description:
      'Devuelve estado READY si la plataforma está operativa para ejecuciones.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/runtime')
  async getRuntimeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.projectsService.assertCanAccessProject(id, request.user);
    return {
      projectId: id,
      workspaceNetworkName: null,
      status: 'READY',
      provisionedAt: new Date().toISOString(),
      lastError: null,
      activeRuns: [], // Se consultan vía /builder/runs
      networks: [],
    };
  }

  @ApiOperation({
    summary: 'Reconciliar runtime (Legacy - No-op)',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post(':id/runtime/reconcile')
  async reconcileRuntime(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.projectsService.assertCanAccessProject(id, request.user);
    return { message: 'Plataforma efímera activa. Reconcile no requerido.' };
  }

  /**
   * Crea un nuevo proyecto academico.
   */
  @ApiOperation({
    summary: 'Crear proyecto',
    description: 'Registra un nuevo proyecto academico en el dominio.',
  })
  @ApiResponse({ status: 201, description: 'Proyecto creado correctamente.' })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post()
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.create(createProjectDto, request.user);
  }

  /**
   * Lista proyectos de forma paginada.
   */
  @ApiOperation({
    summary: 'Listar proyectos',
    description: 'Devuelve el listado paginado de proyectos por filtros.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado recuperado correctamente.',
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
    @Query() query: ListProjectsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedProjectsResponse> {
    return this.projectsService.findAll(query, request.user);
  }

  @ApiOperation({
    summary: 'Consultar incidencias operativas del dominio proyectos',
    description:
      'Resume registros inconsistentes o sensibles para que el profesorado detecte problemas de integridad y seguimiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Incidencias operativas recuperadas correctamente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get('operational-issues')
  async getOperationalIssues(
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectOperationalIssuesSummary> {
    return this.projectsService.getOperationalIssues(request.user);
  }

  @ApiOperation({
    summary: 'Reconciliar incidencias operativas del dominio proyectos',
    description:
      'Permite simular o aplicar una limpieza segura sobre incidencias reconciliables.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliación ejecutada correctamente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('operational-issues/reconcile')
  async reconcileOperationalIssues(
    @Body() dto: ReconcileOperationalIssuesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectOperationalIssuesReconcileResult> {
    return this.projectsService.reconcileOperationalIssues(dto, request.user);
  }

  /**
   * Recupera un proyecto por UUID.
   */
  @ApiOperation({
    summary: 'Consultar proyecto',
    description: 'Devuelve el proyecto asociado al UUID indicado.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Proyecto recuperado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    const project = await this.projectsService.findById(id, request.user);
    if (!project) {
      throw new NotFoundException(PROJECT_NOT_FOUND_DESCRIPTION);
    }

    return project;
  }

  /**
   * Actualiza parcialmente un proyecto.
   */
  @ApiOperation({
    summary: 'Actualizar proyecto',
    description: 'Actualiza parcialmente metadatos del proyecto.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Proyecto actualizado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.update(id, updateProjectDto, request.user);
  }

  /**
   * Actualiza estado funcional del proyecto.
   */
  @ApiOperation({
    summary: 'Actualizar estado de proyecto',
    description: 'Cambia el estado funcional del proyecto indicado.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({
    name: 'status',
    enum: ProjectStatus,
    description: 'Nuevo estado objetivo del proyecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de proyecto actualizado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_INPUT_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch(':id/status/:status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('status', new ParseEnumPipe(ProjectStatus)) status: ProjectStatus,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.updateStatus(id, status, request.user);
  }

  @ApiOperation({
    summary: 'Subir o reemplazar suite docente del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post(':id/test-suite/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedStorageFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    const uploaded = await this.storageService.uploadProjectTestSuite(
      id,
      file,
      request.user,
    );
    return uploaded;
  }

  @ApiOperation({
    summary: 'Consultar suite docente activa',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/test-suite')
  async findTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.findProjectTestSuite(id, request.user);
  }

  @ApiOperation({
    summary: 'Previsualizar contenido de la suite docente (solo ZIP)',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/test-suite/preview')
  async previewTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Array<{ path: string; content: string }>> {
    return this.storageService.previewProjectTestSuite(id, request.user);
  }

  @ApiOperation({
    summary: 'Eliminar suite docente activa',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete(':id/test-suite')
  async removeTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const result = await this.storageService.removeProjectTestSuite(
      id,
      request.user,
    );
    return result;
  }

  @ApiOperation({
    summary: 'Asignar profesor al proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({ name: 'teacherId', description: 'UUID del profesor a asignar.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post(':id/teachers/:teacherId')
  async addTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.addTeacher(id, teacherId, request.user);
  }

  @ApiOperation({
    summary: 'Desasignar profesor del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({
    name: 'teacherId',
    description: 'UUID del profesor a desasignar.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete(':id/teachers/:teacherId')
  async removeTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.removeTeacher(id, teacherId, request.user);
  }

  /**
   * Borrado logico de proyecto.
   */
  @ApiOperation({
    summary: 'Eliminar proyecto',
    description: 'Aplica borrado logico sobre el proyecto indicado.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 204,
    description: 'Proyecto eliminado logicamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projectsService.remove(id);
  }

  /**
   * Restaura un proyecto eliminado logicamente.
   */
  @ApiOperation({
    summary: 'Restaurar proyecto',
    description: 'Recupera un proyecto eliminado mediante soft delete.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Proyecto restaurado correctamente.',
  })
  @ApiResponse({ status: 400, description: INVALID_UUID_DESCRIPTION })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 409,
    description: 'El proyecto ya se encuentra activo.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN)
  @Patch(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<Project> {
    return this.projectsService.restore(id);
  }
}
