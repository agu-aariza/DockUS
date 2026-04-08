import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { rm } from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import {
  DEFAULT_BUILDER_CLEANUP_IMAGES,
  DEFAULT_K8S_NAMESPACE_PREFIX,
} from '../../domain/builder.constants';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { StaticFindingsService } from '../../domain/findings/static-findings.service';
import {
  BuildStage,
  BuilderLlmAssessment,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  ReproducibilityResult,
  ReproducibilitySnapshot,
  RuntimeFile,
  StageStatus,
} from '../../domain/builder.types';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import { BuilderBuildStageService } from './builder-build-stage.service';
import { BuilderCleanupStageService } from './builder-cleanup-stage.service';
import { BuilderDeployStageService } from './builder-deploy-stage.service';
import { BuilderReproducibilityService } from './builder-reproducibility.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderValidationStageService } from './builder-validation-stage.service';
import { BuilderWorkspaceService } from './builder-workspace.service';
import { BuilderRuntimeState } from './builder-runtime.types';

@Injectable()
export class BuilderFrozenReplayPipelineService {
  private readonly namespacePrefix: string;
  private readonly cleanupImages: boolean;

  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly staticFindingsService: StaticFindingsService,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderReproducibilityService: BuilderReproducibilityService,
    private readonly builderBuildStageService: BuilderBuildStageService,
    private readonly builderDeployStageService: BuilderDeployStageService,
    private readonly builderValidationStageService: BuilderValidationStageService,
    private readonly builderCleanupStageService: BuilderCleanupStageService,
    private readonly configService: ConfigService,
  ) {
    this.namespacePrefix =
      this.configService.get<string>(
        'BUILDER_K8S_NAMESPACE_PREFIX',
        DEFAULT_K8S_NAMESPACE_PREFIX,
      ) ?? DEFAULT_K8S_NAMESPACE_PREFIX;
    this.cleanupImages = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_CLEANUP_IMAGES',
        DEFAULT_BUILDER_CLEANUP_IMAGES,
      ),
    );
  }

  async execute(
    run: BuildRun,
    delivery: Delivery,
  ): Promise<BuilderPipelineOutcome> {
    const warnings: string[] = [];
    let workspaceRootDir: string | null = null;
    let imageTag: string | null = null;
    let completed = false;
    let sourceRun: BuildRun | null = null;
    let sourceAssessment: BuilderLlmAssessment | null = null;
    let sourceSnapshot: ReproducibilitySnapshot | null = null;
    let sourceReport: BuilderPipelineOutcome['report'] | null = null;

    const state: BuilderRuntimeState = {
      warnings,
      stageResults: [],
      evidenceArtifacts: [],
      observedEvidence: this.createObservedEvidence(),
      runtimeOutputs: {
        stackResult: null,
        dockerfileContent: null,
        buildLogs: null,
        timingsMs: {},
      },
    };

    try {
      sourceRun = await this.buildRunsRepository.findOne({
        where: { id: run.sourceRunId ?? '' },
      });
      if (!sourceRun) {
        throw new UnprocessableEntityException(
          'El run origen del frozen replay no existe.',
        );
      }

      sourceAssessment = sourceRun.llmAssessment as BuilderLlmAssessment | null;
      sourceSnapshot =
        sourceRun.reproducibilitySnapshot as ReproducibilitySnapshot | null;
      sourceReport =
        (sourceRun.report as BuilderPipelineOutcome['report'] | null) ?? null;

      if (!sourceAssessment || !sourceSnapshot || !sourceReport) {
        throw new UnprocessableEntityException(
          'El run origen no contiene snapshot o reporte reutilizable.',
        );
      }

      const workspace =
        await this.builderWorkspaceService.prepareWorkspaceFromSnapshot(
          sourceSnapshot.inputManifest,
        );
      workspaceRootDir = path.dirname(workspace.projectRootDir);
      for (const warning of workspace.warnings) {
        await this.builderRunSupportService.recordWarning(
          run.id,
          warnings,
          warning,
        );
      }

      const staticFindings = await this.runAnalysisStage(
        run.id,
        workspace.runtimeFiles,
        state,
      );
      this.applyFrozenPlanningOutcome(
        workspace.runtimeFiles,
        sourceAssessment,
        sourceSnapshot,
        state,
      );
      await this.persistAnalysisArtifacts(
        run.id,
        sourceRun.id,
        sourceAssessment,
        sourceSnapshot,
        staticFindings.findings,
        state,
      );

      const executionContext =
        await this.executionAdapterService.collectExecutionContext(
          this.configService.get<string>(
            'BUILDER_BASE_PYTHON_IMAGE',
            sourceSnapshot.executionContext.pythonBaseImage,
          ) ?? sourceSnapshot.executionContext.pythonBaseImage,
        );
      const dockerfile = sourceSnapshot.dockerfile.content;

      imageTag = await this.builderBuildStageService.run({
        variant: 'frozen',
        runId: run.id,
        deliveryId: run.deliveryId,
        dockerfile,
        projectRootDir: workspace.projectRootDir,
        missingReasonCode: 'BUILD_SKIPPED_NO_FROZEN_DOCKERFILE',
        statusPayload: {
          sourceRunId: sourceRun.id,
        },
        state,
      });

      const namespace = await this.builderDeployStageService.run({
        variant: 'frozen',
        run,
        deliveryId: delivery.id,
        recipe: sourceSnapshot.frozenRecipe,
        runtimeMode: state.observedEvidence.runtime.mode,
        imageTag,
        namespacePrefix: this.namespacePrefix,
        state,
      });

      await this.builderValidationStageService.runTests({
        variant: 'frozen',
        run,
        deliveryId: delivery.id,
        recipe: sourceSnapshot.frozenRecipe,
        runtimeMode: state.observedEvidence.runtime.mode,
        namespace,
        imageTag,
        state,
      });
      await this.builderValidationStageService.collectKubernetesEvents({
        run,
        namespace,
        state,
      });
      await this.builderCleanupStageService.run({
        variant: 'frozen',
        run,
        namespace,
        state,
      });

      const reproducibilityResult =
        this.builderReproducibilityService.buildResult({
          replayRunId: run.id,
          sourceRunId: sourceRun.id,
          sourceSnapshot,
          executionContext,
          stageResults: state.stageResults,
          warnings,
          staticFindings: staticFindings.findings,
        });
      await this.persistReproducibilityArtifacts(
        run.id,
        reproducibilityResult,
        state,
      );

      const report = this.builderReproducibilityService.buildReplayReport(
        sourceReport,
        reproducibilityResult,
      );
      await this.persistReportArtifacts(run.id, report, state);

      state.runtimeOutputs.timingsMs = this.builderRunSupportService.toTimings(
        state.stageResults,
      );
      completed = true;
      return {
        llmAssessment: sourceAssessment,
        staticFindings: staticFindings.findings,
        stageResults: state.stageResults,
        evidenceArtifacts: state.evidenceArtifacts,
        report,
        executionContext,
        reproducibilitySnapshot: sourceSnapshot,
        reproducibilityResult,
        runtimeOutputs: state.runtimeOutputs,
        failureReason:
          reproducibilityResult.overallStatus === 'BLOCKED'
            ? reproducibilityResult.summary
            : null,
        warnings,
      };
    } catch (error) {
      if (!sourceRun || !sourceAssessment || !sourceSnapshot || !sourceReport) {
        throw error;
      }

      const summary = `Frozen replay bloqueado: ${this.builderRunSupportService.toErrorMessage(error)}`;
      const reproducibilityResult: ReproducibilityResult = {
        sourceRunId: sourceRun.id,
        replayRunId: run.id,
        overallStatus: 'BLOCKED',
        summary,
        checks: [
          {
            id: 'REPLAY_PRECONDITIONS',
            status: 'BLOCKED',
            expected: 'snapshot y artefactos reutilizables disponibles',
            observed: this.builderRunSupportService.toErrorMessage(error),
          },
        ],
        evidenceRefs: [`run:${sourceRun.id}`],
      };
      const report = this.builderReproducibilityService.buildReplayReport(
        sourceReport,
        reproducibilityResult,
      );
      return {
        llmAssessment: sourceAssessment,
        staticFindings: [],
        stageResults: state.stageResults,
        evidenceArtifacts: state.evidenceArtifacts,
        report,
        executionContext: sourceSnapshot.executionContext,
        reproducibilitySnapshot: sourceSnapshot,
        reproducibilityResult,
        runtimeOutputs: state.runtimeOutputs,
        failureReason: summary,
        warnings: [...warnings, summary],
      };
    } finally {
      if (workspaceRootDir) {
        await rm(workspaceRootDir, { recursive: true, force: true });
      }

      if (this.cleanupImages && imageTag && !completed) {
        await this.builderRunSupportService.cleanupImage(imageTag, warnings);
      }
    }
  }

  private createObservedEvidence(): BuilderObservedEvidence {
    return {
      workspaceSummary: 'Frozen replay cargado desde snapshot.',
      build: {
        attempted: false,
        succeeded: false,
        summary: 'Build no ejecutado.',
        logTail: [],
      },
      runtime: {
        mode: 'analysis_only',
        deploySummary: 'No desplegado.',
        probeSummary: 'No ejecutado.',
        stabilitySummary: 'No ejecutado.',
        testSummary: 'No ejecutado.',
        healthcheckSummary: 'No ejecutado.',
      },
    };
  }

  private async runAnalysisStage(
    runId: string,
    runtimeFiles: RuntimeFile[],
    state: BuilderRuntimeState,
  ) {
    const analysisStarted = this.builderRunSupportService.beginStage(
      BuildStage.ANALYSIS,
    );
    await this.builderRunSupportService.emitStageStarted(
      runId,
      BuildRunStatus.ANALYZING,
      BuildStage.ANALYSIS,
    );
    const staticFindings =
      await this.staticFindingsService.analyze(runtimeFiles);
    const analysisStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.ANALYSIS,
      startedAt: analysisStarted.startedAt,
      status: StageStatus.PASS,
      reasonCode: 'FROZEN_REPLAY_RECIPE_REUSED',
    });
    state.stageResults.push(analysisStageResult);
    return staticFindings;
  }

  private applyFrozenPlanningOutcome(
    runtimeFiles: RuntimeFile[],
    sourceAssessment: BuilderLlmAssessment,
    sourceSnapshot: ReproducibilitySnapshot,
    state: BuilderRuntimeState,
  ): void {
    state.observedEvidence.runtime.mode =
      this.builderRunSupportService.resolveExecutionMode(sourceAssessment);
    state.observedEvidence.runtime.testSummary =
      sourceSnapshot.frozenRecipe.test.length > 0
        ? 'Pendiente de ejecutar según receta congelada.'
        : 'La receta congelada no incluye tests.';
    state.observedEvidence.runtime.healthcheckSummary =
      sourceSnapshot.frozenRecipe.healthcheck !== null
        ? 'Pendiente de ejecutar según receta congelada.'
        : 'La receta congelada no incluye healthcheck.';
    state.runtimeOutputs.stackResult =
      this.builderRunSupportService.buildStackResult({
        runtimeFiles,
        assessment: sourceAssessment,
        model: 'frozen-replay',
      });
  }

  private async persistAnalysisArtifacts(
    runId: string,
    sourceRunId: string,
    sourceAssessment: BuilderLlmAssessment,
    sourceSnapshot: ReproducibilitySnapshot,
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    state: BuilderRuntimeState,
  ): Promise<void> {
    const planningArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.CLASSIFICATION,
      {
        sourceRunId,
        mode: 'frozen-replay',
        assessment: sourceAssessment,
      },
    );
    const recipeArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.STRATEGY,
      sourceSnapshot.frozenRecipe,
    );
    const findingsArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.STATIC_FINDINGS,
      staticFindings,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      planningArtifact,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      recipeArtifact,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      findingsArtifact,
    );

    const analysisStageResult = state.stageResults[0];
    analysisStageResult.evidenceRefs = [
      `artifact:${planningArtifact.id}`,
      `artifact:${recipeArtifact.id}`,
      `artifact:${findingsArtifact.id}`,
    ];
    await this.builderRunSupportService.emitStageFinished(
      runId,
      BuildRunStatus.ANALYZING,
      analysisStageResult,
    );
  }

  private async persistReproducibilityArtifacts(
    runId: string,
    reproducibilityResult: ReproducibilityResult,
    state: BuilderRuntimeState,
  ): Promise<void> {
    const reproducibilityArtifact =
      await this.evidenceService.persistJsonArtifact(
        runId,
        BuildRunArtifactType.REPRODUCIBILITY_JSON,
        reproducibilityResult,
      );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      reproducibilityArtifact,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'REPRODUCIBILITY_READY',
      runStatus: BuildRunStatus.CLEANING,
      stage: null,
      activeStage: null,
      message: `Resultado de reproducibilidad: ${reproducibilityResult.overallStatus}.`,
      payload: {
        overallStatus: reproducibilityResult.overallStatus,
      },
    });
  }

  private async persistReportArtifacts(
    runId: string,
    report: BuilderPipelineOutcome['report'],
    state: BuilderRuntimeState,
  ): Promise<void> {
    const reportJsonArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.REPORT_JSON,
      report,
    );
    const reportTextArtifact = await this.evidenceService.persistTextArtifact(
      runId,
      BuildRunArtifactType.REPORT_TEXT,
      report.readableText,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      reportJsonArtifact,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      reportTextArtifact,
    );
    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'REPORT_READY',
      runStatus: BuildRunStatus.CLEANING,
      stage: null,
      activeStage: null,
      message: 'Informe canónico de replay disponible.',
      payload: {
        reportJsonArtifactId: reportJsonArtifact.id,
        reportTextArtifactId: reportTextArtifact.id,
      },
    });
  }
}
