import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { BuildRun, BuildRunStatus } from '../domain/entities/build-run.entity';
import {
  BuilderRunComparison,
  BuilderRunEvent,
  EvidenceArtifactPublic,
} from '../domain/builder.types';
import { ListBuildRunsDto } from '../presentation/dto/list-build-runs.dto';
import { BuilderRunCommandsService } from './services/builder-run-commands.service';
import { BuilderRunQueriesService } from './services/builder-run-queries.service';
import type {
  EnqueueBuildRunResponse,
  EnqueueReplayBuildRunResponse,
  ExecuteBuildRunJobData,
  PaginatedBuildRunsResponse,
} from './services/builder-application.types';

export type {
  EnqueueBuildRunResponse,
  EnqueueReplayBuildRunResponse,
  ExecuteBuildRunJobData,
  PaginatedBuildRunsResponse,
} from './services/builder-application.types';

@Injectable()
export class BuilderService {
  constructor(
    private readonly builderRunCommandsService: BuilderRunCommandsService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
  ) {}

  enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueBuildRunResponse> {
    return this.builderRunCommandsService.enqueueDeliveryRun(deliveryId, actor);
  }

  enqueueFrozenReplay(
    sourceRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EnqueueReplayBuildRunResponse> {
    return this.builderRunCommandsService.enqueueFrozenReplay(
      sourceRunId,
      actor,
    );
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

  subscribeToRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    listener: (event: BuilderRunEvent) => void,
  ): Promise<() => void> {
    return this.builderRunQueriesService.subscribeToRunEvents(
      buildRunId,
      actor,
      listener,
    );
  }

  compareRuns(
    baseRunId: string,
    candidateRunId: string,
    actor: AuthenticatedUser,
  ): Promise<BuilderRunComparison> {
    return this.builderRunQueriesService.compareRuns(
      baseRunId,
      candidateRunId,
      actor,
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

  getRunReport(
    buildRunId: string,
    actor: AuthenticatedUser,
    format: 'json' | 'text',
  ): Promise<unknown> {
    return this.builderRunQueriesService.getRunReport(
      buildRunId,
      actor,
      format,
    );
  }

  failStaleRunsOnStartup(): Promise<void> {
    return this.builderRunCommandsService.failStaleRunsOnStartup();
  }
}
