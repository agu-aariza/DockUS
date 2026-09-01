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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { ProjectLifecycleService } from '../project-lifecycle.service';
import { ProjectOperationalIssuesService } from '../project-operational-issues.service';
import { ProjectQueryService } from '../project-query.service';
import type {
  PaginatedProjectsResponse,
  ProjectOperationalIssuesReconcileResult,
  ProjectOperationalIssuesSummary,
} from '../projects.types';

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
    private readonly projectQueryService: ProjectQueryService,
    private readonly projectLifecycleService: ProjectLifecycleService,
    private readonly projectOperationalIssuesService: ProjectOperationalIssuesService,
  ) {}

  // El estado del runtime (`projects/:id/runtime`) vive en ProjectRuntimeController.

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
    return this.projectLifecycleService.create(createProjectDto, request.user);
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
    return this.projectQueryService.findAll(query, request.user);
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
    return this.projectOperationalIssuesService.getOperationalIssues(
      request.user,
    );
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
    return this.projectOperationalIssuesService.reconcileOperationalIssues(
      dto,
      request.user,
    );
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
    const project = await this.projectQueryService.findById(id, request.user);
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
    return this.projectLifecycleService.update(
      id,
      updateProjectDto,
      request.user,
    );
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
    return this.projectLifecycleService.updateStatus(id, status, request.user);
  }

  // La suite docente (`projects/:id/test-suite`) vive en ProjectTestSuiteController
  // y la gestión de docentes (`projects/:id/teachers`) en ProjectTeachersController.

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
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.projectLifecycleService.remove(id, request.user);
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
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectLifecycleService.restore(id, request.user);
  }
}
