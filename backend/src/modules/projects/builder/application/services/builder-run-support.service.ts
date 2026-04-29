import { Injectable } from '@nestjs/common';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';
import {
  BuildStage,
  BuilderExecutionMode,
  BuilderPipelineOutcome,
  BuilderPreflightSummary,
  BuildRunRuntimeTarget,
  EvidenceArtifactPublic,
  LlmPlanRecipe,
  RuntimeFile,
  StageResult,
  StageStatus,
} from '../../domain/builder.types';
import { BuilderRunStateService } from './builder-run-state.service';
import { BuilderRunTelemetryService } from './builder-run-telemetry.service';

@Injectable()
export class BuilderRunSupportService {
  constructor(
    private readonly builderRunStateService: BuilderRunStateService,
    private readonly builderRunTelemetryService: BuilderRunTelemetryService,
  ) {}

  async updateRunStatus(
    runId: string,
    status: BuildRunStatus,
    startedAt?: Date,
  ): Promise<void> {
    return this.builderRunStateService.updateRunStatus(
      runId,
      status,
      startedAt,
    );
  }

  async emitEvent(input: {
    buildRunId: string;
    eventType:
      | 'RUN_ENQUEUED'
      | 'RUN_STARTED'
      | 'RUN_STATUS_CHANGED'
      | 'STAGE_STARTED'
      | 'STAGE_FINISHED'
      | 'LOG_CHUNK'
      | 'WARNING_ADDED'
      | 'ARTIFACT_ADDED'
      | 'REPORT_READY'
      | 'RUN_COMPLETED'
      | 'RUN_FAILED'
      | 'RUN_CANCELLED';
    runStatus?: BuildRunStatus | null;
    stage?: BuildStage | null;
    activeStage?: BuildStage | null;
    message: string;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    return this.builderRunTelemetryService.emitEvent(input);
  }

  async emitStageStarted(
    runId: string,
    runStatus: BuildRunStatus,
    stage: BuildStage,
  ): Promise<void> {
    return this.builderRunTelemetryService.emitStageStarted(
      runId,
      runStatus,
      stage,
    );
  }

  async emitStageFinished(
    runId: string,
    runStatus: BuildRunStatus,
    stageResult: StageResult,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    return this.builderRunTelemetryService.emitStageFinished(
      runId,
      runStatus,
      stageResult,
      payload,
    );
  }

  async recordWarning(
    runId: string,
    warnings: string[],
    warning: string,
  ): Promise<void> {
    return this.builderRunTelemetryService.recordWarning(
      runId,
      warnings,
      warning,
    );
  }

  async recordArtifact(
    runId: string,
    artifacts: EvidenceArtifactPublic[],
    artifact: EvidenceArtifactPublic,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    return this.builderRunTelemetryService.recordArtifact(
      runId,
      artifacts,
      artifact,
      payload,
    );
  }

  async emitLogChunk(input: {
    buildRunId: string;
    source: 'build' | 'runtime' | 'tests' | 'probes' | 'cleanup';
    stream: 'stdout' | 'stderr' | 'combined';
    text: string;
    containerId?: string | null;
    containerName?: string | null;
    stage?: BuildStage | null;
  }): Promise<void> {
    return this.builderRunTelemetryService.emitLogChunk(input);
  }

  beginStage(stage: BuildStage): { stage: BuildStage; startedAt: Date } {
    return this.builderRunTelemetryService.beginStage(stage);
  }

  finishStage(input: {
    stage: BuildStage;
    startedAt: Date;
    status: StageStatus;
    reasonCode: string;
    evidenceRefs?: string[];
  }): StageResult {
    return this.builderRunTelemetryService.finishStage(input);
  }

  toSkippedStage(stage: BuildStage, reasonCode: string): StageResult {
    return this.builderRunTelemetryService.toSkippedStage(stage, reasonCode);
  }

  toManualStage(
    stage: BuildStage,
    status: StageStatus,
    reasonCode: string,
  ): StageResult {
    return this.builderRunTelemetryService.toManualStage(
      stage,
      status,
      reasonCode,
    );
  }

  async runLlmPhaseWithRetry<T>(
    phase: string,
    warnings: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.builderRunTelemetryService.runLlmPhaseWithRetry(
      phase,
      warnings,
      operation,
    );
  }

  buildStackResult(input: {
    runtimeFiles: RuntimeFile[];
    assessment: BuilderPipelineOutcome['llmAssessment'];
    model: string;
    preflightSummary?: BuilderPreflightSummary | null;
  }): Record<string, unknown> {
    return this.builderRunTelemetryService.buildStackResult(input);
  }

  resolveExecutionMode(
    assessment: BuilderPipelineOutcome['llmAssessment'],
  ): BuilderExecutionMode {
    return this.builderRunTelemetryService.resolveExecutionMode(assessment);
  }

  stageStatusForCheckPrefix(
    checks: Array<{ id: string; status: StageStatus }>,
    prefix: string,
  ): StageStatus {
    return this.builderRunTelemetryService.stageStatusForCheckPrefix(
      checks,
      prefix,
    );
  }

  latestStageResult(
    stageResults: StageResult[],
    stage: BuildStage,
  ): StageResult | null {
    return this.builderRunTelemetryService.latestStageResult(
      stageResults,
      stage,
    );
  }

  diffRecipes(previous: LlmPlanRecipe, next: LlmPlanRecipe): string[] {
    return this.builderRunTelemetryService.diffRecipes(previous, next);
  }

  buildSelfHealingHints(input: {
    buildLogText?: string | null;
    containerLogs?: string | null;
    containerInspect?: string | null;
    runtimeEvents?: string | null;
  }): string[] {
    return this.builderRunTelemetryService.buildSelfHealingHints(input);
  }

  toTimings(stageResults: StageResult[]): Record<string, number> {
    return this.builderRunTelemetryService.toTimings(stageResults);
  }

  createImageTag(deliveryId: string): string {
    return this.builderRunTelemetryService.createImageTag(deliveryId);
  }

  async updateRuntimeTarget(
    runId: string,
    patch: Partial<BuildRunRuntimeTarget>,
  ): Promise<BuildRunRuntimeTarget | null> {
    return this.builderRunStateService.updateRuntimeTarget(runId, patch);
  }

  async appendRuntimeHelperContainer(
    runId: string,
    containerId: string | null | undefined,
  ): Promise<BuildRunRuntimeTarget | null> {
    return this.builderRunStateService.appendRuntimeHelperContainer(
      runId,
      containerId,
    );
  }

  async cleanupImage(imageTag: string, warnings: string[]): Promise<void> {
    return this.builderRunStateService.cleanupImage(imageTag, warnings);
  }

  isTerminalStatus(status: BuildRunStatus): boolean {
    return this.builderRunStateService.isTerminalStatus(status);
  }

  async markRunAsFailed(
    buildRunId: string,
    errorMessage: string,
  ): Promise<void> {
    return this.builderRunStateService.markRunAsFailed(
      buildRunId,
      errorMessage,
    );
  }

  async markRunAsCancelled(buildRunId: string, reason: string): Promise<void> {
    return this.builderRunStateService.markRunAsCancelled(buildRunId, reason);
  }

  toErrorMessage(error: unknown): string {
    return this.builderRunTelemetryService.toErrorMessage(error);
  }
}
