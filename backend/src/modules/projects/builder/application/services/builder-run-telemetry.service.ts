import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';
import { BuilderRunEventsService } from '../../domain/events/builder-run-events.service';
import {
  BuildStage,
  BuilderExecutionMode,
  BuilderPipelineOutcome,
  BuilderPreflightSummary,
  EvidenceArtifactPublic,
  LlmPlanRecipe,
  RuntimeFile,
  StageResult,
  StageStatus,
} from '../../domain/builder.types';
import { BuildRunStatus } from '../../domain/entities/build-run.entity';

@Injectable()
export class BuilderRunTelemetryService {
  constructor(
    private readonly builderRunEventsService: BuilderRunEventsService,
  ) {}

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

  async emitLogChunk(input: {
    buildRunId: string;
    source: 'build' | 'runtime' | 'tests' | 'probes' | 'cleanup';
    stream: 'stdout' | 'stderr' | 'combined';
    text: string;
    containerId?: string | null;
    containerName?: string | null;
    stage?: BuildStage | null;
  }): Promise<void> {
    const normalized = input.text.replace(/\r\n/gu, '\n');
    const maxChars = 4096;
    for (let index = 0; index < normalized.length; index += maxChars) {
      const chunk = normalized.slice(index, index + maxChars);
      if (!chunk) {
        continue;
      }
      await this.emitEvent({
        buildRunId: input.buildRunId,
        eventType: 'LOG_CHUNK',
        runStatus: null,
        stage: input.stage ?? null,
        activeStage: input.stage ?? null,
        message: 'Chunk de logs recibido.',
        payload: {
          source: input.source,
          stream: input.stream,
          containerId: input.containerId ?? null,
          containerName: input.containerName ?? null,
          text: chunk,
        },
      });
    }
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
    phase: string,
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
    preflightSummary?: BuilderPreflightSummary | null;
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
      dockusManifest: fileList.filter((file) =>
        /(^|\/)dockus\.ya?ml$/u.test(file),
      ),
    };

    return {
      language: 'python',
      dependencyManager:
        input.preflightSummary?.dependencyManager ??
        input.assessment.recipe.dependencyManager ??
        'unknown',
      executionProfile:
        input.preflightSummary?.executionProfile ??
        input.assessment.recipe.executionProfile ??
        'unknown',
      workingDirectory:
        input.preflightSummary?.workingDirectory ??
        input.assessment.recipe.workingDirectory ??
        '.',
      manifestSource:
        input.preflightSummary?.manifestSource ??
        input.assessment.recipe.manifestSource ??
        'AUTO',
      manifests,
      pythonFiles: fileList.filter((file) => file.endsWith('.py')).length,
      resolvedCommands: input.preflightSummary
        ? {
            install: input.preflightSummary.resolvedCommands.install,
            run: input.preflightSummary.resolvedCommands.run,
            test: input.preflightSummary.resolvedCommands.test,
            healthcheck: input.preflightSummary.resolvedCommands.healthcheck,
          }
        : null,
      planner: {
        source:
          input.preflightSummary?.compatibility === 'SUPPORTED_AUTO'
            ? 'preflight-auto'
            : input.preflightSummary?.compatibility ===
                'SUPPORTED_WITH_MANIFEST'
              ? 'dockus-manifest'
              : 'llm-assisted',
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

  latestStageResult(
    stageResults: StageResult[],
    stage: BuildStage,
  ): StageResult | null {
    for (let index = stageResults.length - 1; index >= 0; index -= 1) {
      const candidate = stageResults[index];
      if (candidate.stage === stage) {
        return candidate;
      }
    }
    return null;
  }

  diffRecipes(previous: LlmPlanRecipe, next: LlmPlanRecipe): string[] {
    const diff: string[] = [];

    if (JSON.stringify(previous.install) !== JSON.stringify(next.install)) {
      diff.push('install');
    }
    if (
      JSON.stringify(previous.systemPackages) !==
      JSON.stringify(next.systemPackages)
    ) {
      diff.push('systemPackages');
    }
    if (JSON.stringify(previous.run) !== JSON.stringify(next.run)) {
      diff.push('run');
    }
    if (
      JSON.stringify(previous.healthcheck) !== JSON.stringify(next.healthcheck)
    ) {
      diff.push('healthcheck');
    }
    if (previous.servicePort !== next.servicePort) {
      diff.push('servicePort');
    }

    return diff;
  }

  buildSelfHealingHints(input: {
    buildLogText?: string | null;
    containerLogs?: string | null;
    containerInspect?: string | null;
    runtimeEvents?: string | null;
  }): string[] {
    const corpus = [
      input.buildLogText ?? '',
      input.containerLogs ?? '',
      input.containerInspect ?? '',
      input.runtimeEvents ?? '',
    ].join('\n');
    const hints = new Set<string>();

    const lower = corpus.toLowerCase();
    if (
      lower.includes('no module named psycopg2') ||
      lower.includes("can't find libpq") ||
      lower.includes('pg_config executable not found')
    ) {
      hints.add(
        'Puede faltar psycopg2-binary o el paquete de sistema libpq-dev.',
      );
    }
    if (lower.includes('mysqlclient') && lower.includes('pkg-config')) {
      hints.add(
        'Puede faltar pkg-config y librerías de desarrollo de MySQL/MariaDB.',
      );
    }
    if (lower.includes('modulenotfounderror')) {
      hints.add('El runtime parece fallar por una dependencia Python ausente.');
    }
    if (
      lower.includes('fatal error:') ||
      lower.includes('failed building wheel')
    ) {
      hints.add(
        'La compilación parece requerir toolchain o headers del sistema adicionales.',
      );
    }
    if (lower.includes('error loading shared libraries')) {
      hints.add(
        'El contenedor parece necesitar una librería compartida del sistema.',
      );
    }

    return [...hints];
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
