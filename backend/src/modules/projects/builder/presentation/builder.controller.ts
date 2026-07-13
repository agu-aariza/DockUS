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
import type { Response } from 'express';
import {
  INVALID_UUID_DESCRIPTION,
  FORBIDDEN_DESCRIPTION,
  INTERNAL_SERVER_ERROR_DESCRIPTION,
  UNAUTHORIZED_DESCRIPTION,
} from '../../../../shared/http/http-response.constants';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../users/entities/user.entity';
import { BuilderRunCommandsService } from '../application/services/orchestration/builder-run-commands.service';
import { BuilderRunQueriesService } from '../application/services/orchestration/builder-run-queries.service';
import { BuilderLlmChatService } from '../domain/ai/builder-llm-chat.service';
import {
  BuildRunResponseDto,
  BuildRunEventsResponseDto,
  CancelBuildRunResponseDto,
  EvidenceArtifactDto,
  EvidenceDownloadUrlDto,
  EnqueueBuildRunResponseDto,
  PaginatedBuildRunsResponseDto,
  toBuildRunResponseDto,
} from './dto/build-run-response.dto';
import { ListBuildRunsDto } from './dto/list-build-runs.dto';
import { PostChatMessageDto } from './dto/chat-message.dto';
import { BuildRunChatMessage } from '../domain/entities/build-run-chat-message.entity';

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

/**
 * Tope de páginas al drenar el backlog inicial del SSE (200 eventos por página).
 * Cubre runs con historial extenso sin permitir que el bucle gire para siempre
 * sobre un run que aún está produciendo eventos.
 */
const MAX_BACKLOG_DRAIN_PAGES = 50;

@ApiTags('Builder')
@ApiBearerAuth()
@Controller('builder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuilderController {
  constructor(
    private readonly builderRunCommandsService: BuilderRunCommandsService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderLlmChatService: BuilderLlmChatService,
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
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('deliveries/:deliveryId/run')
  async runForDelivery(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EnqueueBuildRunResponseDto> {
    return this.builderRunCommandsService.enqueueDeliveryRun(
      deliveryId,
      request.user,
    );
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
    const run = await this.builderRunQueriesService.getRunById(
      buildRunId,
      request.user,
    );
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
  @SkipThrottle({ burst: true })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/events')
  async getRunEvents(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('afterSequence', new DefaultValuePipe(0), ParseIntPipe)
    afterSequence: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunEventsResponseDto> {
    const page = await this.builderRunQueriesService.listRunEvents(
      buildRunId,
      request.user,
      afterSequence,
      limit,
    );
    return {
      events: page.events,
      latestSequence: page.latestSequence,
      hasMore: page.hasMore,
    };
  }

  @ApiOperation({
    summary: 'Streaming SSE de un run',
    description:
      'Entrega backlog inicial y nuevos eventos del run mediante Server-Sent Events.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/stream')
  async getRunEventsStream(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Query('afterSequence', new DefaultValuePipe(0), ParseIntPipe)
    afterSequence: number,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const firstPage = await this.builderRunQueriesService.listRunEvents(
      buildRunId,
      request.user,
      afterSequence,
      200,
    );
    let latestSequence = Math.max(afterSequence, firstPage.latestSequence);
    response.write(
      `event: ready\ndata: ${JSON.stringify({ latestSequence })}\n\n`,
    );

    for (const event of firstPage.events) {
      response.write(`event: run-event\ndata: ${JSON.stringify(event)}\n\n`);
    }

    // Drena el backlog con un tope de páginas: sobre un run activo y verboso, el
    // worker inserta eventos más rápido de lo que se leen y el bucle no
    // terminaría, martilleando Postgres y sin llegar nunca al subscribe(). Los
    // eventos que lleguen entre medias los recoge la suscripción, y el cliente
    // deduplica por `sequence`.
    let hasMore = firstPage.hasMore;
    let drainedPages = 0;
    while (hasMore && drainedPages < MAX_BACKLOG_DRAIN_PAGES) {
      const page = await this.builderRunQueriesService.listRunEvents(
        buildRunId,
        request.user,
        latestSequence,
        200,
      );
      latestSequence = Math.max(latestSequence, page.latestSequence);
      hasMore = page.hasMore;
      drainedPages += 1;
      for (const event of page.events) {
        response.write(`event: run-event\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }

    const unsubscribe = await this.builderRunQueriesService.subscribeRunEvents(
      buildRunId,
      request.user,
      (event) => {
        latestSequence = Math.max(latestSequence, event.sequence);
        response.write(`event: run-event\ndata: ${JSON.stringify(event)}\n\n`);
      },
    );

    const heartbeat = setInterval(() => {
      response.write(': heartbeat\n\n');
    }, 15000);

    request.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
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
    const response = await this.builderRunQueriesService.listRunsByDelivery(
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
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post('runs/:buildRunId/cancel')
  async cancelRun(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CancelBuildRunResponseDto> {
    return this.builderRunCommandsService.cancelRun(buildRunId, request.user);
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
    return this.builderRunQueriesService.listEvidenceArtifacts(
      buildRunId,
      request.user,
    );
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
    return this.builderRunQueriesService.createEvidenceDownloadUrl(
      buildRunId,
      artifactId,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Obtener contenido de un artefacto de evidencia',
    description:
      'Devuelve el contenido del artefacto directamente (proxy sobre MinIO). Evita exponer URLs internas al navegador.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @ApiParam({
    name: 'artifactId',
    description: 'UUID del artefacto de evidencia.',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenido del artefacto devuelto correctamente.',
  })
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/evidence/:artifactId/content')
  async getEvidenceContent(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const { content, contentType } =
      await this.builderRunQueriesService.getEvidenceArtifactContent(
        buildRunId,
        artifactId,
        request.user,
      );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', content.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(content);
  }

  @ApiOperation({
    summary: 'Obtener insights de calidad por assignment',
    description:
      'Agrega patrones de calidad de todos los alumnos de un assignment.',
  })
  @ApiParam({ name: 'assignmentId', description: 'UUID del assignment.' })
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get('assignments/:assignmentId/quality-insights')
  async getAssignmentQualityInsights(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.builderRunQueriesService.getAssignmentQualityInsights(
      assignmentId,
      request.user,
    );
  }

  @ApiOperation({
    summary: 'Obtener historial de mensajes del Tutor IA',
    description:
      'Lista todos los mensajes intercambiados con el Tutor IA para este run.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Get('runs/:buildRunId/chat/messages')
  async getChatMessages(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunChatMessage[]> {
    await this.builderRunQueriesService.getRunById(buildRunId, request.user);
    return this.builderLlmChatService.getChatMessages(buildRunId);
  }

  @ApiOperation({
    summary: 'Enviar pregunta al Tutor IA',
    description:
      'Envía una consulta sobre los resultados del run y recibe la respuesta del tutor.',
  })
  @ApiParam(BUILD_RUN_ID_PARAM)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @Post('runs/:buildRunId/chat')
  async postChatMessage(
    @Param('buildRunId', ParseUUIDPipe) buildRunId: string,
    @Body() body: PostChatMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BuildRunChatMessage> {
    await this.builderRunQueriesService.getRunById(buildRunId, request.user);
    return this.builderLlmChatService.postChatMessage(buildRunId, body.message);
  }
}
