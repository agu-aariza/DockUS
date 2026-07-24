import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  FORBIDDEN_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ProjectProgressQueryDto } from '../dto/project-progress-query.dto';
import {
  ProjectGradebookRow,
  ProjectQualityInsightsSummary,
  ProjectStudentQualityInsights,
  ProjectsService,
} from '../projects.service';
import {
  CODE_QUALITY_CATEGORIES,
  type CodeQualityCategory,
} from '../builder/domain/builder.types';

/**
 * `ParseEnumPipe` espera un objeto de valores admitidos; `CODE_QUALITY_CATEGORIES`
 * es una tupla `as const`. Se deriva de ella para que añadir una categoría al
 * dominio actualice a la vez la validación y la documentación de Swagger.
 */
const QUALITY_CATEGORY_ENUM = Object.fromEntries(
  CODE_QUALITY_CATEGORIES.map((category) => [category, category]),
) as Record<CodeQualityCategory, CodeQualityCategory>;

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
export class ProjectGradebookController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({
    summary: 'Consultar insights agregados de calidad del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/quality-insights')
  async getQualityInsights(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectQualityInsightsSummary> {
    return this.projectsService.getQualityInsights(id, request.user);
  }

  @ApiOperation({
    summary: 'Consultar insights agregados de calidad por categoría',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({
    name: 'category',
    description: 'Categoría de hallazgos agregados.',
    enum: CODE_QUALITY_CATEGORIES,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/quality-insights/categories/:category')
  async getQualityInsightsByCategory(
    @Param('id', ParseUUIDPipe) id: string,
    // `ParseEnumPipe` acepta el objeto de valores admitidos; se construye desde
    // la misma constante que documenta el parámetro en Swagger, de modo que
    // ambos no puedan divergir.
    @Param('category', new ParseEnumPipe(QUALITY_CATEGORY_ENUM))
    category: CodeQualityCategory,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectQualityInsightsSummary> {
    return this.projectsService.getQualityInsightsByCategory(
      id,
      category,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Consultar hallazgos de calidad de un alumno dentro del proyecto',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({ name: 'studentId', description: 'UUID del alumno.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id/quality-insights/students/:studentId')
  async getQualityInsightsForStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectStudentQualityInsights> {
    return this.projectsService.getQualityInsightsForStudent(
      id,
      studentId,
      request.user,
    );
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
