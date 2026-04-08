import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rm } from 'fs/promises';
import * as path from 'path';
import {
  DEFAULT_BUILDER_CLEANUP_IMAGES,
  DEFAULT_K8S_NAMESPACE_PREFIX,
} from '../../domain/builder.constants';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from '../../domain/evaluation/builder-evaluation-llm.service';
import { StaticFindingsService } from '../../domain/findings/static-findings.service';
import { BuilderPlanLlmService } from '../../domain/planning/builder-plan-llm.service';
import { BuilderReportService } from '../../domain/reporting/builder-report.service';
import { DockerfileTemplateService } from '../../domain/templates/dockerfile-template.service';
import {
  BuildStage,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  ReproducibilitySnapshotInput,
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
export class BuilderStandardPipelineService {
  private readonly namespacePrefix: string;
  private readonly basePythonImage: string;
  private readonly cleanupImages: boolean;

  constructor(
    private readonly staticFindingsService: StaticFindingsService,
    private readonly builderPlanLlmService: BuilderPlanLlmService,
    private readonly builderEvaluationLlmService: BuilderEvaluationLlmService,
    private readonly dockerfileTemplateService: DockerfileTemplateService,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderReportService: BuilderReportService,
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderReproducibilityService: BuilderReproducibilityService,
    private readonly builderBuildStageService: BuilderBuildStageService,
    private readonly builderDeployStageService: BuilderDeployStageService,
    private readonly builderValidationStageService: BuilderValidationStageService,
    private readonly builderCleanupStageService: BuilderCleanupStageService,
    private readonly configService: ConfigService,
  ) {
    this.cleanupImages = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_CLEANUP_IMAGES',
        DEFAULT_BUILDER_CLEANUP_IMAGES,
      ),
    );
    this.namespacePrefix =
      this.configService.get<string>(
        'BUILDER_K8S_NAMESPACE_PREFIX',
        DEFAULT_K8S_NAMESPACE_PREFIX,
      ) ?? DEFAULT_K8S_NAMESPACE_PREFIX;
    this.basePythonImage =
      this.configService.get<string>(
        'BUILDER_BASE_PYTHON_IMAGE',
        'python:3.11.9-slim-bookworm',
      ) ?? 'python:3.11.9-slim-bookworm';
  }

  async execute(
    run: BuildRun,
    delivery: Delivery,
  ): Promise<BuilderPipelineOutcome> {
    const warnings: string[] = [];
    let inputManifest: ReproducibilitySnapshotInput[] = [];
    let workspaceRootDir: string | null = null;
    let imageTag: string | null = null;
    let completed = false;

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
      const workspace = await this.builderWorkspaceService.prepareWorkspace(
        delivery.id,
      );
      inputManifest = workspace.inputManifest;
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
      const planResult = await this.runPlanningPhase(
        workspace.runtimeFiles,
        staticFindings.findings,
        warnings,
      );
      this.applyPlanningOutcome(state, workspace.runtimeFiles, planResult);
      await this.persistPlanningArtifacts(
        run.id,
        staticFindings.findings,
        planResult,
        state,
      );

      const executionContext =
        await this.executionAdapterService.collectExecutionContext(
          this.basePythonImage,
        );
      const dockerfile = this.dockerfileTemplateService.render(
        planResult.assessment,
      );

      imageTag = await this.builderBuildStageService.run({
        variant: 'standard',
        runId: run.id,
        deliveryId: delivery.id,
        dockerfile,
        projectRootDir: workspace.projectRootDir,
        missingReasonCode: 'BUILD_SKIPPED_NO_RECIPE',
        statusPayload: {
          structuralType: planResult.assessment.structuralType,
          executionMode: state.observedEvidence.runtime.mode,
        },
        state,
      });

      const namespace = await this.builderDeployStageService.run({
        variant: 'standard',
        run,
        deliveryId: delivery.id,
        recipe: planResult.assessment.recipe,
        runtimeMode: state.observedEvidence.runtime.mode,
        imageTag,
        namespacePrefix: this.namespacePrefix,
        state,
      });

      await this.builderValidationStageService.runTests({
        variant: 'standard',
        run,
        deliveryId: delivery.id,
        recipe: planResult.assessment.recipe,
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
        variant: 'standard',
        run,
        namespace,
        state,
      });

      const evaluationResult = await this.runEvaluationPhase(
        planResult.assessment,
        executionContext,
        state,
        staticFindings.findings,
      );
      const report = this.builderReportService.create({
        assessment: evaluationResult.assessment,
        stageResults: state.stageResults,
        relevantEvidence: state.evidenceArtifacts.map(
          (artifact) => artifact.id,
        ),
      });

      await this.persistReportArtifacts(run.id, report, state);
      state.runtimeOutputs.timingsMs = this.builderRunSupportService.toTimings(
        state.stageResults,
      );
      const reproducibilitySnapshot =
        this.builderReproducibilityService.buildSnapshot({
          runId: run.id,
          deliveryId: delivery.id,
          inputManifest,
          assessment: evaluationResult.assessment,
          dockerfile,
          executionContext,
          stageResults: state.stageResults,
          warnings,
          failureReason: null,
          staticFindings: staticFindings.findings,
        });
      completed = true;
      return {
        llmAssessment: evaluationResult.assessment,
        staticFindings: staticFindings.findings,
        stageResults: state.stageResults,
        evidenceArtifacts: state.evidenceArtifacts,
        report,
        executionContext,
        reproducibilitySnapshot,
        reproducibilityResult: null,
        runtimeOutputs: state.runtimeOutputs,
        failureReason: null,
        warnings,
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
      workspaceSummary: '',
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
      reasonCode: 'LLM_PLANNING_COMPLETED',
    });
    state.stageResults.push(analysisStageResult);
    return staticFindings;
  }

  private async runPlanningPhase(
    runtimeFiles: RuntimeFile[],
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    warnings: string[],
  ) {
    return this.builderRunSupportService.runLlmPhaseWithRetry(
      'planning',
      warnings,
      async () => {
        if (!this.builderPlanLlmService.isEnabled()) {
          throw new ServiceUnavailableException(
            'El planner LLM del builder está desactivado.',
          );
        }
        const result = await this.builderPlanLlmService.generatePlan({
          runtimeFiles,
          staticFindings,
        });
        if (!result) {
          throw new ServiceUnavailableException(
            'El planner LLM no devolvió una evaluación inicial.',
          );
        }
        return result;
      },
    );
  }

  private applyPlanningOutcome(
    state: BuilderRuntimeState,
    runtimeFiles: RuntimeFile[],
    planResult: Awaited<ReturnType<BuilderPlanLlmService['generatePlan']>>,
  ): void {
    if (!planResult) {
      return;
    }

    state.observedEvidence.workspaceSummary =
      planResult.assessment.evidenceSummary;
    state.observedEvidence.runtime.mode =
      this.builderRunSupportService.resolveExecutionMode(planResult.assessment);
    state.observedEvidence.runtime.testSummary =
      planResult.assessment.recipe.test.length > 0
        ? 'Pendiente de ejecutar según receta del planner LLM.'
        : 'El planner LLM no propuso tests.';
    state.observedEvidence.runtime.healthcheckSummary =
      planResult.assessment.recipe.healthcheck !== null
        ? 'Pendiente de ejecutar según receta del planner LLM.'
        : 'El planner LLM no propuso healthcheck.';

    state.runtimeOutputs.stackResult =
      this.builderRunSupportService.buildStackResult({
        runtimeFiles,
        assessment: planResult.assessment,
        model: planResult.model,
      });
  }

  private async persistPlanningArtifacts(
    runId: string,
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    planResult: Awaited<ReturnType<BuilderPlanLlmService['generatePlan']>>,
    state: BuilderRuntimeState,
  ): Promise<void> {
    if (!planResult) {
      return;
    }

    const planningArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.CLASSIFICATION,
      {
        model: planResult.model,
        assessment: planResult.assessment,
      },
    );
    const recipeArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.STRATEGY,
      planResult.assessment.recipe,
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

  private async runEvaluationPhase(
    planningAssessment: BuilderPipelineOutcome['llmAssessment'],
    executionContext: BuilderPipelineOutcome['executionContext'],
    state: BuilderRuntimeState,
    staticFindings: BuilderPipelineOutcome['staticFindings'],
  ) {
    return this.builderRunSupportService.runLlmPhaseWithRetry(
      'evaluation',
      state.warnings,
      async () => {
        if (!this.builderEvaluationLlmService.isEnabled()) {
          throw new ServiceUnavailableException(
            'La evaluación LLM del builder está desactivada.',
          );
        }
        const result = await this.builderEvaluationLlmService.evaluate({
          planningAssessment,
          stageResults: state.stageResults,
          staticFindings,
          warnings: state.warnings,
          executionContext,
          evidenceArtifacts: state.evidenceArtifacts.map((artifact) => ({
            id: artifact.id,
            type: artifact.type,
          })),
          observedEvidence: state.observedEvidence,
        });
        if (!result) {
          throw new ServiceUnavailableException(
            'La evaluación LLM no devolvió un veredicto final.',
          );
        }
        return result;
      },
    );
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
      message: 'Informe canónico disponible.',
      payload: {
        reportJsonArtifactId: reportJsonArtifact.id,
        reportTextArtifactId: reportTextArtifact.id,
      },
    });
  }
}
