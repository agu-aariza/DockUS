/**
 * @fileoverview Endpoint de ejecucion del Builder MVP.
 *
 * Contexto:
 * - Expone pipeline de analisis/build para entregas Python.
 * - Aplica JWT + RBAC y ownership para estudiantes.
 *
 * @module BuilderController
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  INVALID_UUID_DESCRIPTION,
  FORBIDDEN_DESCRIPTION,
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../../shared/http/http-response.constants';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { BuilderService } from '../application/builder.service';
import {
  BuildRunResponseDto,
  CancelBuildRunResponseDto,
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
  EnqueueBuildRunResponseDto,
  PaginatedBuildRunsResponseDto,
  TeacherReportResponseDto,
  toBuildRunResponseDto,
} from './dto/build-run-response.dto';
import { ListBuildRunsDto } from './dto/list-build-runs.dto';

const DELIVERY_ID_PARAM = {
  name: 'deliveryId',
  description: 'UUID de entrega sobre la que se ejecuta el builder.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

const BUILD_RUN_ID_PARAM = {
  name: 'buildRunId',
  description: 'UUID de ejecución del builder.',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

@ApiTags('Builder')
@ApiBearerAuth()
@Controller('builder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuilderController {
  constructor(private readonly builderService: BuilderService) {}

  @ApiOperation({
    summary: 'Encolar ejecución Builder para una entrega',
    description:
      'Crea una ejecución en cola y devuelve un identificador para consultar su estado.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 202,
    description: 'Ejecución encolada correctamente.',
    type: EnqueueBuildRunResponseDto,
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
    status: 404,
    description: 'Entrega no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una ejecución activa para la entrega.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('deliveries/:deliveryId/run')
  async runForDelivery(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EnqueueBuildRunResponseDto> {
    return this.builderService.enqueueDeliveryRun(deliveryId, request.user);
  }

  @ApiOperation({
    summary: 'Consultar estado de una ejecución Builder',
    description: 'Devuelve estado y resultado persistido del run indicado.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Run recuperado correctamente.',
    type: BuildRunResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_UUID_DESCRIPTION,
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
    status: 404,
    description: 'BuildRun no encontrado.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId')
  async getRunById(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunResponseDto> {
    const run = await this.builderService.getRunById(buildRunId, request.user);
    return toBuildRunResponseDto(run);
  }

  @ApiOperation({
    summary: 'Listar historial de ejecuciones por entrega',
    description: 'Devuelve runs paginados de una entrega.',
  })
  @ApiParam(DELIVERY_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Historial de runs recuperado correctamente.',
    type: PaginatedBuildRunsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: INVALID_UUID_DESCRIPTION,
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
    status: 404,
    description: 'Entrega no encontrada.',
  })
  @ApiResponse({
    status: 500,
    description: INTERNAL_SERVER_ERROR_DESCRIPTION,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('deliveries/:deliveryId/runs')
  async getRunsByDelivery(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Query() query: ListBuildRunsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedBuildRunsResponseDto> {
    const response = await this.builderService.listRunsByDelivery(
      deliveryId,
      query,
      request.user,
    );
    return {
      data: response.data.map((run) => toBuildRunResponseDto(run)),
      meta: response.meta,
    };
  }

  @ApiOperation({
    summary: 'Cancelar ejecución de builder',
    description: 'Cancela una ejecución en curso o en cola.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Run cancelado correctamente.',
    type: CancelBuildRunResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('runs/:buildRunId/cancel')
  async cancelRun(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CancelBuildRunResponseDto> {
    return this.builderService.cancelRun(buildRunId, request.user);
  }

  @ApiOperation({
    summary: 'Obtener informe docente de un run',
    description: 'Devuelve el teacherReport en formato JSON o texto.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Informe recuperado correctamente.',
    type: TeacherReportResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/report')
  async getRunReport(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('format') format: 'json' | 'text' | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeacherReportResponseDto> {
    return this.builderService.getRunReport(
      buildRunId,
      request.user,
      format ?? 'json',
    ) as Promise<TeacherReportResponseDto>;
  }

  @ApiOperation({
    summary: 'Listar evidencias de un run',
    description: 'Devuelve artefactos persistidos para trazabilidad.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Evidencias listadas correctamente.',
    type: [EvidenceArtifactDto],
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/evidence')
  async listEvidence(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EvidenceArtifactDto[]> {
    return this.builderService.listEvidenceArtifacts(buildRunId, request.user);
  }

  @ApiOperation({
    summary: 'Obtener URL de descarga de evidencia',
    description: 'Genera URL firmada para descargar un artefacto de evidencia.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiParam({
    name: 'artifactId',
    description: 'UUID del artefacto de evidencia.',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: 200,
    description: 'URL firmada generada correctamente.',
    type: EvidenceDownloadUrlDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/evidence/:artifactId/download-url')
  async getEvidenceDownloadUrl(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EvidenceDownloadUrlDto> {
    return this.builderService.createEvidenceDownloadUrl(
      buildRunId,
      artifactId,
      request.user,
    );
  }
}
