import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../domain/events/builder-run-events.service';
import {
  BuildStage,
  BuilderExecutionMode,
  BuilderPipelineOutcome,
  EvidenceArtifactPublic,
  RuntimeFile,
  StageResult,
  StageStatus,
} from '../../domain/builder.types';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';

@Injectable()
export class BuilderRunSupportService {
  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly builderRunEventsService: BuilderRunEventsService,
    private readonly executionAdapterService: ExecutionAdapterService,
  ) {}

  async updateRunStatus(
    runId: string,
    status: BuildRunStatus,
    startedAt?: Date,
  ): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: runId },
    });
    if (!run) {
      return;
    }
    if (run.status === BuildRunStatus.CANCELLED) {
      throw new ConflictException('Run cancelado durante procesamiento.');
    }
    run.status = status;
    if (startedAt && !run.startedAt) {
      run.startedAt = startedAt;
    }
    await this.buildRunsRepository.save(run);
  }

  async emitEvent(input: {
    buildRunId: string;
    eventType:
      | 'RUN_ENQUEUED'
      | 'RUN_STARTED'
      | 'RUN_STATUS_CHANGED'
      | 'STAGE_STARTED'
      | 'STAGE_FINISHED'
      | 'WARNING_ADDED'
      | 'ARTIFACT_ADDED'
      | 'REPORT_READY'
      | 'REPRODUCIBILITY_READY'
      | 'RUN_COMPLETED'
      | 'RUN_FAILED'
      | 'RUN_CANCELLED';
    runStatus?: BuildRunStatus | null;
    stage?: BuildStage | null;
    activeStage?: BuildStage | null;
    message: string;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.builderRunEventsService.emit(input);
  }

  async emitStageStarted(
    runId: string,
    runStatus: BuildRunStatus,
    stage: BuildStage,
  ): Promise<void> {
    await this.emitEvent({
      buildRunId: runId,
      eventType: 'STAGE_STARTED',
      runStatus,
      stage,
      activeStage: stage,
      message: `Inicio de etapa ${stage}.`,
    });
  }

  async emitStageFinished(
    runId: string,
    runStatus: BuildRunStatus,
    stageResult: StageResult,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.emitEvent({
      buildRunId: runId,
      eventType: 'STAGE_FINISHED',
      runStatus,
      stage: stageResult.stage,
      activeStage: null,
      message: `Etapa ${stageResult.stage} finalizada con ${stageResult.status}.`,
      payload: {
        status: stageResult.status,
        reasonCode: stageResult.reasonCode,
        durationMs: stageResult.durationMs,
        evidenceRefs: stageResult.evidenceRefs,
        ...(payload ?? {}),
      },
    });
  }

  async recordWarning(
    runId: string,
    warnings: string[],
    warning: string,
  ): Promise<void> {
    warnings.push(warning);
    await this.emitEvent({
      buildRunId: runId,
      eventType: 'WARNING_ADDED',
      runStatus: null,
      stage: null,
      message: warning,
      payload: { warning },
    });
  }

  async recordArtifact(
    runId: string,
    artifacts: EvidenceArtifactPublic[],
    artifact: EvidenceArtifactPublic,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    artifacts.push(artifact);
    await this.emitEvent({
      buildRunId: runId,
      eventType: 'ARTIFACT_ADDED',
      runStatus: null,
      stage: null,
      message: `Artefacto ${artifact.type} persistido.`,
      payload: {
        artifactId: artifact.id,
        artifactType: artifact.type,
        ...(payload ?? {}),
      },
    });
  }

  beginStage(stage: BuildStage): {
    stage: BuildStage;
    startedAt: Date;
  } {
    return {
      stage,
      startedAt: new Date(),
    };
  }

  finishStage(input: {
    stage: BuildStage;
    startedAt: Date;
    status: StageStatus;
    reasonCode: string;
    evidenceRefs?: string[];
  }): StageResult {
    const finishedAt = new Date();
    return {
      stage: input.stage,
      status: input.status,
      startedAt: input.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - input.startedAt.getTime(),
      reasonCode: input.reasonCode,
      evidenceRefs: input.evidenceRefs ?? [],
    };
  }

  toSkippedStage(stage: BuildStage, reasonCode: string): StageResult {
    const now = new Date();
    return {
      stage,
      status: StageStatus.SKIP,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      reasonCode,
      evidenceRefs: [],
    };
  }

  toManualStage(
    stage: BuildStage,
    status: StageStatus,
    reasonCode: string,
  ): StageResult {
    const now = new Date();
    return {
      stage,
      status,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      reasonCode,
      evidenceRefs: [],
    };
  }

  async runLlmPhaseWithRetry<T>(
    phase: 'planning' | 'evaluation',
    warnings: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        warnings.push(
          `Fallo en fase LLM ${phase} intento ${attempt}/2: ${this.toErrorMessage(error)}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `La fase LLM ${phase} falló tras 2 intentos: ${this.toErrorMessage(lastError)}`,
    );
  }

  buildStackResult(input: {
    runtimeFiles: RuntimeFile[];
    assessment: BuilderPipelineOutcome['llmAssessment'];
    model: string;
  }): Record<string, unknown> {
    const fileList = input.runtimeFiles.map((file) =>
      toPosixPath(file.relativePath),
    );
    const manifests = {
      requirements: fileList.filter((file) =>
        /(^|\/)requirements[^/]*\.txt$/u.test(file),
      ),
      pyprojectToml: fileList.filter((file) => file.endsWith('pyproject.toml')),
      setupPy: fileList.filter((file) => file.endsWith('setup.py')),
      setupCfg: fileList.filter((file) => file.endsWith('setup.cfg')),
      managePy: fileList.filter((file) => file.endsWith('manage.py')),
    };

    return {
      language: 'python',
      manifests,
      pythonFiles: fileList.filter((file) => file.endsWith('.py')).length,
      planner: {
        source: 'llm-only',
        model: input.model,
        structuralType: input.assessment.structuralType,
        evaluativeState: input.assessment.evaluativeState,
        confidence: input.assessment.confidence,
      },
    };
  }

  resolveExecutionMode(
    assessment: BuilderPipelineOutcome['llmAssessment'],
  ): BuilderExecutionMode {
    if (!assessment.recipe.run) {
      return 'analysis_only';
    }

    if (assessment.capabilities.C3.status === 'yes') {
      return 'service';
    }

    return 'batch';
  }

  stageStatusForCheckPrefix(
    checks: Array<{ id: string; status: StageStatus }>,
    prefix: string,
  ): StageStatus {
    const matching = checks.filter((check) => check.id.startsWith(prefix));
    if (matching.length === 0) {
      return StageStatus.SKIP;
    }
    return matching.every((check) => check.status === StageStatus.PASS)
      ? StageStatus.PASS
      : StageStatus.FAIL;
  }

  toTimings(stageResults: StageResult[]): Record<string, number> {
    const timings: Record<string, number> = {};
    for (const stageResult of stageResults) {
      timings[stageResult.stage.toLowerCase()] = stageResult.durationMs;
    }
    timings.total = stageResults.reduce(
      (sum, stageResult) => sum + stageResult.durationMs,
      0,
    );
    return timings;
  }

  createImageTag(deliveryId: string): string {
    const normalizedDeliveryId = deliveryId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return `dockus-delivery-${normalizedDeliveryId}:run-${Date.now()}`;
  }

  async cleanupImage(imageTag: string, warnings: string[]): Promise<void> {
    try {
      const removed =
        await this.executionAdapterService.removeDockerImage(imageTag);
      if (!removed) {
        warnings.push(`No se pudo limpiar imagen ${imageTag}.`);
      }
    } catch (error) {
      warnings.push(
        `No se pudo limpiar la imagen ${imageTag}: ${this.toErrorMessage(error)}`,
      );
    }
  }

  isTerminalStatus(status: BuildRunStatus): boolean {
    return (
      status === BuildRunStatus.SUCCESS ||
      status === BuildRunStatus.FAILED ||
      status === BuildRunStatus.CANCELLED
    );
  }

  async markRunAsFailed(
    buildRunId: string,
    errorMessage: string,
  ): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      return;
    }

    run.status = BuildRunStatus.FAILED;
    run.activeStage = null;
    run.finishedAt = new Date();
    run.failureReason = errorMessage;
    run.buildLogs = {
      ...(typeof run.buildLogs === 'object' && run.buildLogs
        ? run.buildLogs
        : {}),
      error: errorMessage,
    };
    await this.buildRunsRepository.save(run);
    await this.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_FAILED',
      runStatus: BuildRunStatus.FAILED,
      stage: null,
      activeStage: null,
      message: errorMessage,
      payload: { error: errorMessage },
    });
  }

  async markRunAsCancelled(buildRunId: string, reason: string): Promise<void> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      return;
    }

    run.status = BuildRunStatus.CANCELLED;
    run.activeStage = null;
    run.finishedAt = new Date();
    run.failureReason = reason;
    run.warnings = [...(run.warnings ?? []), reason];
    await this.buildRunsRepository.save(run);
    await this.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_CANCELLED',
      runStatus: BuildRunStatus.CANCELLED,
      stage: null,
      activeStage: null,
      message: reason,
    });
  }

  toErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error no tipado en ejecución de builder.';
  }
}
