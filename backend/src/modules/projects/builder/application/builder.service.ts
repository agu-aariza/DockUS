/**
 * @fileoverview Fachada de aplicación del subdominio builder.
 *
 * Contexto:
 * - Expone una superficie acotada para controller y processor.
 * - Deriva cada operación a los servicios especializados de comandos y consultas.
 *
 * @module BuilderService
 */

import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { BuildRun, BuildRunStatus } from '../domain/entities/build-run.entity';
import { EvidenceArtifactPublic } from '../domain/builder.types';
import { ListBuildRunsDto } from '../presentation/dto/list-build-runs.dto';
import { BuilderRunCommandsService } from './services/builder-run-commands.service';
import { BuilderRunQueriesService } from './services/builder-run-queries.service';
import type {
  EnqueueBuildRunResponse,
  ExecuteBuildRunJobData,
  PaginatedBuildRunsResponse,
} from './services/builder-application.types';

export type {
  EnqueueBuildRunResponse,
  ExecuteBuildRunJobData,
  PaginatedBuildRunsResponse,
} from './services/builder-application.types';

@Injectable()
export class BuilderService {
  constructor(
    private readonly builderRunCommandsService: BuilderRunCommandsService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
  ) {}

  /**
   * Encola una ejecución estándar sobre la entrega indicada.
   */
  enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    return this.builderRunCommandsService.enqueueDeliveryRun(deliveryId, actor);
  }

  cancelRun(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buildRunId: string; status: BuildRunStatus }> {
    return this.builderRunCommandsService.cancelRun(buildRunId, actor);
  }

  listRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    afterSequence = 0,
    limit = 100,
  ) {
    return this.builderRunQueriesService.listRunEvents(
      buildRunId,
      actor,
      afterSequence,
      limit,
    );
  }

  subscribeRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    listener: (
      event: import('../domain/builder.types').BuilderRunEvent,
    ) => void,
  ) {
    return this.builderRunQueriesService.subscribeRunEvents(
      buildRunId,
      actor,
      listener,
    );
  }

  processBuildRunJob(data: ExecuteBuildRunJobData): Promise<void> {
    return this.builderRunCommandsService.processBuildRunJob(data);
  }

  getRunById(buildRunId: string, actor: AuthenticatedUser): Promise<BuildRun> {
    return this.builderRunQueriesService.getRunById(buildRunId, actor);
  }

  listRunsByDelivery(
    deliveryId: string,
    query: ListBuildRunsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedBuildRunsResponse> {
    return this.builderRunQueriesService.listRunsByDelivery(
      deliveryId,
      query,
      actor,
    );
  }

  listEvidenceArtifacts(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EvidenceArtifactPublic[]> {
    return this.builderRunQueriesService.listEvidenceArtifacts(
      buildRunId,
      actor,
    );
  }

  createEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.builderRunQueriesService.createEvidenceDownloadUrl(
      buildRunId,
      artifactId,
      actor,
    );
  }

  failStaleRunsOnStartup(): Promise<void> {
    return this.builderRunCommandsService.failStaleRunsOnStartup();
  }

  getAssignmentQualityInsights(
    assignmentId: string,
    actor: AuthenticatedUser,
  ) {
    return this.builderRunQueriesService.getAssignmentQualityInsights(
      assignmentId,
      actor,
    );
  }
}
