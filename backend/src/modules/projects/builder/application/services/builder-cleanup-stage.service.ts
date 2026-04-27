import { Injectable } from '@nestjs/common';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import { BuildStage, StageStatus } from '../../domain/builder.types';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRuntimeStageInput } from './builder-runtime.types';

@Injectable()
export class BuilderCleanupStageService {
  constructor(
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async run(
    input: Pick<BuilderRuntimeStageInput, 'run' | 'state' | 'clusterName'> & {
      namespace: string | null;
    },
  ): Promise<void> {
    await this.builderRunSupportService.updateRunStatus(
      input.run.id,
      BuildRunStatus.CLEANING,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: input.run.id,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.CLEANING,
      stage: BuildStage.CLEANUP,
      activeStage: BuildStage.CLEANUP,
      message: 'Run entrando en cleanup.',
    });

    const cleanupStarted = this.builderRunSupportService.beginStage(
      BuildStage.CLEANUP,
    );
    await this.builderRunSupportService.emitStageStarted(
      input.run.id,
      BuildRunStatus.CLEANING,
      BuildStage.CLEANUP,
    );

    let cleanupStatus = StageStatus.PASS;
    let cleanupReason = 'CLEANUP_OK';
    let orphanedResources: string[] = [];
    if (input.namespace) {
      const cleanup = await this.executionAdapterService.cleanupNamespace(
        input.clusterName,
        input.namespace,
      );
      cleanupStatus = cleanup.status;
      cleanupReason = cleanup.reasonCode;
      orphanedResources = cleanup.orphanedResources;
    }

    const cleanupStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.CLEANUP,
      startedAt: cleanupStarted.startedAt,
      status: cleanupStatus,
      reasonCode: cleanupReason,
      evidenceRefs: orphanedResources.length
        ? [`orphaned:${orphanedResources.join(',')}`]
        : [],
    });
    input.state.stageResults.push(cleanupStageResult);
    await this.builderRunSupportService.emitStageFinished(
      input.run.id,
      BuildRunStatus.CLEANING,
      cleanupStageResult,
    );
    input.state.currentAttemptDiagnostics.namespace = null;
    await this.builderRunSupportService.updateRuntimeTarget(input.run.id, {
      primaryPodName: null,
      helperPodNames: [],
    });

    if (orphanedResources.length > 0) {
      await this.builderRunSupportService.recordWarning(
        input.run.id,
        input.state.warnings,
        `Recursos huérfanos detectados tras cleanup: ${orphanedResources.join(', ')}`,
      );
    }
  }
}
