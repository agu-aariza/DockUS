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
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
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
  BuildRunComparisonRequestDto,
  BuildRunComparisonResponseDto,
  BuildRunEventsResponseDto,
  BuildRunEventDto,
  BuildRunReportResponseDto,
  CancelBuildRunResponseDto,
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
  EnqueueBuildRunResponseDto,
  PaginatedBuildRunsResponseDto,
  ReplayBuildRunResponseDto,
  toBuildRunResponseDto,
} from './dto/build-run-response.dto';
import { ListBuildRunsDto } from './dto/list-build-runs.dto';
import { BuilderRunStreamService } from './services/builder-run-stream.service';
import type { Response } from 'express';

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
  constructor(
    private readonly builderService: BuilderService,
    private readonly builderRunStreamService: BuilderRunStreamService,
  ) {}

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
    summary: 'Listar eventos de un run',
    description:
      'Devuelve backlog incremental de eventos para reconstruir el timeline observable.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Eventos recuperados correctamente.',
    type: BuildRunEventsResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/events')
  async getRunEvents(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('afterSequence', new DefaultValuePipe(0), ParseIntPipe)
    afterSequence: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunEventsResponseDto> {
    const page = await this.builderService.listRunEvents(
      buildRunId,
      request.user,
      afterSequence,
      limit,
    );
    return {
      events: page.events as BuildRunEventDto[],
      latestSequence: page.latestSequence,
      hasMore: page.hasMore,
    };
  }

  @ApiOperation({
    summary: 'Stream SSE de un run',
    description:
      'Abre un stream server-sent events con cambios de estado, etapas, warnings y artefactos.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/stream')
  async streamRunEvents(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('afterSequence') afterSequenceRaw: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const afterSequence = Number.parseInt(afterSequenceRaw ?? '0', 10) || 0;
    await this.builderRunStreamService.openRunEventStream({
      buildRunId,
      afterSequence,
      actor: request.user,
      response,
    });
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
    summary: 'Encolar frozen replay de un run',
    description:
      'Crea una nueva ejecución enlazada al run origen reutilizando snapshot y receta congelados.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 202,
    description: 'Frozen replay encolado correctamente.',
    type: ReplayBuildRunResponseDto,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('runs/:buildRunId/replay')
  async replayRun(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ReplayBuildRunResponseDto> {
    return this.builderService.enqueueFrozenReplay(buildRunId, request.user);
  }

  @ApiOperation({
    summary: 'Obtener informe canónico de un run',
    description:
      'Devuelve el informe canónico derivado de la evaluación LLM final en formato JSON o texto.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Informe recuperado correctamente.',
    type: BuildRunReportResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/report')
  async getRunReport(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('format') format: 'json' | 'text' | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunReportResponseDto> {
    return this.builderService.getRunReport(
      buildRunId,
      request.user,
      format ?? 'json',
    ) as Promise<BuildRunReportResponseDto>;
  }

  @ApiOperation({
    summary: 'Comparar técnicamente dos runs',
    description:
      'Devuelve un delta determinista entre un run base y un run candidato de la misma entrega.',
  })
  @ApiResponse({
    status: 200,
    description: 'Comparación recuperada correctamente.',
    type: BuildRunComparisonResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('runs/compare')
  async compareRuns(
    @Body() body: BuildRunComparisonRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunComparisonResponseDto> {
    const comparison = await this.builderService.compareRuns(
      body.baseRunId,
      body.candidateRunId,
      request.user,
    );
    return {
      overallVerdict: comparison.overallVerdict,
      comparison,
    };
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
