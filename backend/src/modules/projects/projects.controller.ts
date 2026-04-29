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
  Res,
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
  ApiProduces,
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
} from '../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectProgressQueryDto } from './dto/project-progress-query.dto';
import { ReconcileOperationalIssuesDto } from './dto/reconcile-operational-issues.dto';
import { Project, ProjectStatus } from './entities/project.entity';
import {
  ProjectGradebookRow,
  ProjectOperationalIssuesReconcileResult,
  PaginatedProjectsResponse,
  ProjectOperationalIssuesSummary,
  ProjectsService,
} from './projects.service';
import {
  StorageObjectResponse,
  StorageService,
} from './storage/storage.service';
import { UploadedStorageFile } from './storage/interfaces/uploaded-storage-file.interface';

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
    return this.projectsService.create(createProjectDto, request.user.userId);
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
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/test-suite')
  async findTestSuite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageObjectResponse> {
    return this.storageService.findProjectTestSuite(id, request.user);
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

  /**
   * Resumen de progreso de un proyecto para el profesor.
   */
  @ApiOperation({
    summary: 'Resumen de progreso del proyecto',
    description:
      'Devuelve estadísticas agregadas de entregas y alumnos asignados. Solo accesible por el profesor creador y admins.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Resumen generado correctamente.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/progress-summary')
  async progressSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectProgressQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.getProgressSummary(id, request.user, query);
  }

  @ApiOperation({
    summary: 'Gradebook del proyecto',
    description:
      'Devuelve una tabla plana por alumno para seguimiento y calificación operativa.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Gradebook recuperado correctamente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/gradebook')
  async gradebook(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectProgressQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectGradebookRow[]> {
    return this.projectsService.getGradebook(id, request.user, query);
  }

  @ApiOperation({
    summary: 'Exportar gradebook del proyecto en CSV',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'Exportación CSV del gradebook generada correctamente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/gradebook/export')
  async exportGradebook(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectProgressQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.projectsService.exportGradebookCsv(
      id,
      request.user,
      query,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="project-${id}-gradebook.csv"`,
    );
    response.send(csv);
  }

  @ApiOperation({
    summary: 'Exportar seguimiento del proyecto en CSV',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'Exportación CSV generada correctamente.',
  })
  @ApiResponse({ status: 401, description: UNAUTHORIZED_DESCRIPTION })
  @ApiResponse({ status: 403, description: FORBIDDEN_DESCRIPTION })
  @ApiResponse({ status: 404, description: PROJECT_NOT_FOUND_DESCRIPTION })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/progress-summary/export')
  async exportProgressSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectProgressQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.projectsService.exportProgressSummaryCsv(
      id,
      request.user,
      query,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="project-${id}-progress.csv"`,
    );
    response.send(csv);
  }
}
