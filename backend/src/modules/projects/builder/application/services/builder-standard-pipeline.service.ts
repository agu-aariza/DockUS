/**
 * @fileoverview Orquestador del pipeline estándar del builder.
 *
 * Contexto:
 * - Coordina preparación de workspace, análisis, planificación, ejecución y
 *   evaluación final.
 * - Añade self-healing controlado para reparar recetas cuando fallan build o
 *   arranque en Kubernetes por dependencias de entorno.
 *
 * @module BuilderStandardPipelineService
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rm } from 'fs/promises';
import * as path from 'path';
import {
  DEFAULT_BUILDER_CLEANUP_IMAGES,
  DEFAULT_EXECUTION_NETWORK_PREFIX,
  DEFAULT_SELF_HEAL_MAX_ATTEMPTS,
} from '../../domain/builder.constants';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from '../../domain/evaluation/builder-evaluation-llm.service';
import { BuilderTechnicalFeedbackLlmService } from '../../domain/evaluation/builder-technical-feedback-llm.service';
import { BuilderStaticReviewService } from '../../domain/findings/builder-static-review.service';
import { StaticFindingsService } from '../../domain/findings/static-findings.service';
import {
  BuilderLlmPhaseResult,
  BuilderPreflightSummary,
  BuilderSelfHealingAttempt,
  BuildStage,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  BuilderTechnicalFeedback,
  LlmPlanRecipe,
  RuntimeFile,
  StageStatus,
  StaticReviewIssue,
  AssignmentContext,
} from '../../domain/builder.types';
import { BuilderPlanLlmService } from '../../domain/planning/builder-plan-llm.service';
import { BuilderRepairLlmService } from '../../domain/planning/builder-repair-llm.service';
import { BuilderReportService } from '../../domain/reporting/builder-report.service';
import { DockerfileTemplateService } from '../../domain/templates/dockerfile-template.service';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import { BuilderBuildStageService } from './builder-build-stage.service';
import { BuilderCleanupStageService } from './builder-cleanup-stage.service';
import { BuilderPreflightService } from './builder-preflight.service';
import { BuilderDeployStageService } from './builder-deploy-stage.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderValidationStageService } from './builder-validation-stage.service';
import {
  BuilderAttemptDiagnostics,
  BuilderRuntimeState,
} from './builder-runtime.types';
import { BuilderWorkspaceService } from './builder-workspace.service';

interface BuilderInternalState extends BuilderRuntimeState {
  assignmentContext: AssignmentContext;
}

interface AnalysisStageOutput {
  staticFindings: BuilderPipelineOutcome['staticFindings'];
  staticReviewIssues: StaticReviewIssue[];
}

interface RepairDecision {
  shouldRetry: boolean;
  nextAssessment: BuilderPipelineOutcome['llmAssessment'] | null;
  traceEntry: BuilderSelfHealingAttempt | null;
}

@Injectable()
export class BuilderStandardPipelineService {
  private readonly executionNetworkPrefix: string;
  private readonly basePythonImage: string;
  private readonly cleanupImages: boolean;
  private readonly selfHealMaxAttempts: number;

  constructor(
    private readonly staticFindingsService: StaticFindingsService,
    private readonly builderStaticReviewService: BuilderStaticReviewService,
    private readonly builderPlanLlmService: BuilderPlanLlmService,
    private readonly builderRepairLlmService: BuilderRepairLlmService,
    private readonly builderEvaluationLlmService: BuilderEvaluationLlmService,
    private readonly builderTechnicalFeedbackLlmService: BuilderTechnicalFeedbackLlmService,
    private readonly dockerfileTemplateService: DockerfileTemplateService,
    private readonly executionAdapterService: ExecutionAdapterService,
    private readonly evidenceService: EvidenceService,
    private readonly builderReportService: BuilderReportService,
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderPreflightService: BuilderPreflightService,
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
    this.executionNetworkPrefix =
      this.configService.get<string>(
        'BUILDER_EXECUTION_NETWORK_PREFIX',
        DEFAULT_EXECUTION_NETWORK_PREFIX,
      ) ?? DEFAULT_EXECUTION_NETWORK_PREFIX;
    this.basePythonImage =
      this.configService.get<string>(
        'BUILDER_BASE_PYTHON_IMAGE',
        'python:3.11.9-slim-bookworm',
      ) ?? 'python:3.11.9-slim-bookworm';
    this.selfHealMaxAttempts = this.configService.get<number>(
      'BUILDER_SELF_HEAL_MAX_ATTEMPTS',
      DEFAULT_SELF_HEAL_MAX_ATTEMPTS,
    );
  }

  async execute(
    run: BuildRun,
    delivery: Delivery,
    assignmentContext: AssignmentContext,
  ): Promise<BuilderPipelineOutcome> {
    const warnings: string[] = [];
    let workspaceRootDir: string | null = null;
    let lastImageTag: string | null = null;
    let completed = false;

    const state: BuilderInternalState = {
      warnings,
      stageResults: [],
      evidenceArtifacts: [],
      observedEvidence: this.createObservedEvidence(),
      staticReviewIssues: [],
      staticReviewWarnings: [],
      selfHealingTrace: [],
      currentAttemptDiagnostics: this.createEmptyAttemptDiagnostics(),
      assignmentContext,
      runtimeOutputs: {
        stackResult: null,
        dockerfileContent: null,
        buildLogs: null,
        timingsMs: {},
        staticReview: {
          issues: [],
          warnings: [],
        },
        selfHealingTrace: [],
      },
    };

    try {
      const workspaceNetworkName =
        typeof run.runtimeTarget?.workspaceNetworkName === 'string' &&
        run.runtimeTarget.workspaceNetworkName.trim()
          ? run.runtimeTarget.workspaceNetworkName
          : null;
      if (!workspaceNetworkName) {
        throw new ServiceUnavailableException(
          'El run no dispone de una red workspace de runtime asociada.',
        );
      }
      const workspace = await this.builderWorkspaceService.prepareWorkspace(
        delivery.id,
      );
      workspaceRootDir = path.dirname(workspace.projectRootDir);
      for (const warning of workspace.warnings) {
        await this.builderRunSupportService.recordWarning(
          run.id,
          warnings,
          warning,
        );
      }
      const preflightSummary = await this.builderPreflightService.detect(
        workspace.runtimeFiles,
      );
      await this.builderPreflightService.recordWarnings(
        run.id,
        warnings,
        preflightSummary,
      );

      const executionContext =
        await this.executionAdapterService.collectExecutionContext(
          this.basePythonImage,
          workspaceNetworkName,
        );

      if (preflightSummary.compatibility === 'UNSUPPORTED') {
        completed = true;
        return this.completeUnsupportedPreflight({
          runId: run.id,
          runtimeFiles: workspace.runtimeFiles,
          preflightSummary,
          executionContext,
          state,
        });
      }

      const analysis = await this.runAnalysisStage(
        run.id,
        workspace.projectRootDir,
        workspace.runtimeFiles,
        state,
      );
      const planResult = this.builderPreflightService.isFastPath(
        preflightSummary,
      )
        ? this.builderPreflightService.buildFastPathPlan(preflightSummary)
        : await this.runPlanningPhase(
            workspace.projectRootDir,
            workspace.runtimeFiles,
            analysis.staticFindings,
            warnings,
            state.assignmentContext,
            preflightSummary,
          );
      this.applyTeacherTestSuitePolicy(planResult, workspace.hasTeacherTests);
      let currentAssessment = this.cloneAssessment(planResult.assessment);
      this.applyAssessmentOutcome(
        state,
        workspace.runtimeFiles,
        currentAssessment,
        planResult.model,
        preflightSummary,
      );
      await this.persistPlanningArtifacts(
        run.id,
        analysis.staticFindings,
        analysis.staticReviewIssues,
        planResult,
        preflightSummary,
        state,
      );

      for (
        let attemptNumber = 1;
        attemptNumber <= this.selfHealMaxAttempts;
        attemptNumber += 1
      ) {
        this.resetAttemptDiagnostics(state);
        const runtimeMode =
          this.builderRunSupportService.resolveExecutionMode(currentAssessment);
        state.observedEvidence.runtime.mode = runtimeMode;
        const dockerfile =
          this.dockerfileTemplateService.render(currentAssessment);

        const imageTag = await this.builderBuildStageService.run({
          runId: run.id,
          deliveryId: delivery.id,
          dockerfile,
          projectRootDir: workspace.projectRootDir,
          missingReasonCode: 'BUILD_SKIPPED_NO_RECIPE',
          statusPayload: {
            attemptNumber,
            structuralType: currentAssessment.structuralType,
            executionMode: runtimeMode,
          },
          state,
        });
        lastImageTag = imageTag;

        const executionNetworkName = await this.builderDeployStageService.run({
          run,
          deliveryId: delivery.id,
          workspaceNetworkName,
          recipe: currentAssessment.recipe,
          runtimeMode,
          imageTag,
          executionNetworkPrefix: this.executionNetworkPrefix,
          state,
        });

        const repairDecision = await this.evaluateRepairDecision({
          run,
          attemptNumber,
          delivery,
          workspaceNetworkName,
          projectRootDir: workspace.projectRootDir,
          runtimeFiles: workspace.runtimeFiles,
          currentAssessment,
          staticFindings: analysis.staticFindings,
          staticReviewIssues: analysis.staticReviewIssues,
          executionNetworkName,
          imageTag,
          state,
        });

        if (repairDecision.traceEntry) {
          state.selfHealingTrace.push(repairDecision.traceEntry);
          state.runtimeOutputs.selfHealingTrace = [...state.selfHealingTrace];
        }

        if (repairDecision.shouldRetry && repairDecision.nextAssessment) {
          lastImageTag = null;
          currentAssessment = this.cloneAssessment(
            repairDecision.nextAssessment,
          );
          this.applyTeacherTestSuitePolicy(
            { model: planResult.model, assessment: currentAssessment },
            workspace.hasTeacherTests,
          );
          this.applyAssessmentOutcome(
            state,
            workspace.runtimeFiles,
            currentAssessment,
            planResult.model,
            preflightSummary,
          );
          await this.cleanupAttemptResources(
            run,
            workspaceNetworkName,
            executionNetworkName,
            imageTag,
            state,
          );
          continue;
        }

        const deployStage = this.builderRunSupportService.latestStageResult(
          state.stageResults,
          BuildStage.DEPLOY,
        );
        const runtimeReady = deployStage?.status === StageStatus.PASS;

        await this.builderValidationStageService.runTests({
          run,
          deliveryId: delivery.id,
          workspaceNetworkName,
          recipe: currentAssessment.recipe,
          runtimeMode,
          executionNetworkName: runtimeReady ? executionNetworkName : null,
          imageTag: runtimeReady ? imageTag : null,
          state,
        });
        await this.builderValidationStageService.collectRuntimeEvents({
          run,
          workspaceNetworkName,
          executionNetworkName,
          state,
        });
        await this.builderCleanupStageService.run({
          run,
          workspaceNetworkName,
          executionNetworkName,
          state,
        });
        lastImageTag = imageTag;
        break;
      }

      await this.persistSelfHealingTrace(run.id, state);

      const evaluationPromise = this.runEvaluationPhase(
        currentAssessment,
        executionContext,
        state,
        analysis.staticFindings,
        analysis.staticReviewIssues,
      );

      const technicalFeedbackPromise = this.runTechnicalFeedbackPhase({
        assessment: currentAssessment, // Using currentAssessment to allow concurrent execution
        runtimeFiles: workspace.runtimeFiles,
        state,
        staticFindings: analysis.staticFindings,
        staticReviewIssues: analysis.staticReviewIssues,
        runId: run.id,
      });

      const [evaluationResult, technicalFeedback] = await Promise.all([
        evaluationPromise,
        technicalFeedbackPromise,
      ]);

      const report = this.builderReportService.create({
        assessment: evaluationResult.assessment,
        stageResults: state.stageResults,
        relevantEvidence: state.evidenceArtifacts.map(
          (artifact) => artifact.id,
        ),
        technicalFeedback,
        selfHealingTrace: state.selfHealingTrace,
      });

      await this.persistReportArtifacts(run.id, report, state);
      state.runtimeOutputs.timingsMs = this.builderRunSupportService.toTimings(
        state.stageResults,
      );
      completed = true;
      return {
        preflightSummary,
        llmAssessment: evaluationResult.assessment,
        staticFindings: analysis.staticFindings,
        staticReviewIssues: analysis.staticReviewIssues,
        stageResults: state.stageResults,
        evidenceArtifacts: state.evidenceArtifacts,
        report,
        executionContext,
        runtimeOutputs: state.runtimeOutputs,
        failureReason: null,
        warnings,
      };
    } finally {
      if (workspaceRootDir) {
        await rm(workspaceRootDir, { recursive: true, force: true });
      }

      if (this.cleanupImages && lastImageTag && !completed) {
        await this.builderRunSupportService.cleanupImage(
          lastImageTag,
          warnings,
        );
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

  private createEmptyAttemptDiagnostics(): BuilderAttemptDiagnostics {
    return {
      buildLogText: null,
      buildLogTail: [],
      containerLogs: null,
      containerLogTail: [],
      containerInspect: null,
      runtimeEvents: null,
      imageTag: null,
      executionNetworkName: null,
    };
  }

  private resetAttemptDiagnostics(state: BuilderRuntimeState): void {
    state.currentAttemptDiagnostics = this.createEmptyAttemptDiagnostics();
  }

  private async runAnalysisStage(
    runId: string,
    projectRootDir: string,
    runtimeFiles: RuntimeFile[],
    state: BuilderRuntimeState,
  ): Promise<AnalysisStageOutput> {
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
    const staticReview =
      await this.builderStaticReviewService.analyze(projectRootDir);
    state.staticReviewIssues = staticReview.issues;
    state.staticReviewWarnings = staticReview.warnings;
    state.runtimeOutputs.staticReview = {
      issues: staticReview.issues,
      warnings: staticReview.warnings,
    };

    const analysisStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.ANALYSIS,
      startedAt: analysisStarted.startedAt,
      status: StageStatus.PASS,
      reasonCode: 'LLM_PLANNING_COMPLETED',
    });
    state.stageResults.push(analysisStageResult);

    for (const warning of staticReview.warnings) {
      await this.builderRunSupportService.recordWarning(
        runId,
        state.warnings,
        warning,
      );
    }

    return {
      staticFindings: staticFindings.findings,
      staticReviewIssues: staticReview.issues,
    };
  }

  private async runPlanningPhase(
    projectRootDir: string,
    runtimeFiles: RuntimeFile[],
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    warnings: string[],
    assignmentContext: AssignmentContext,
    preflightSummary: BuilderPreflightSummary,
  ): Promise<BuilderLlmPhaseResult> {
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
          projectRootDir,
          runtimeFiles,
          staticFindings,
          assignmentContext,
          preflightSummary,
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

  private applyAssessmentOutcome(
    state: BuilderRuntimeState,
    runtimeFiles: RuntimeFile[],
    assessment: BuilderPipelineOutcome['llmAssessment'],
    model: string,
    preflightSummary: BuilderPreflightSummary,
  ): void {
    state.observedEvidence.workspaceSummary = assessment.evidenceSummary;
    state.observedEvidence.runtime.mode =
      this.builderRunSupportService.resolveExecutionMode(assessment);
    state.observedEvidence.runtime.testSummary =
      assessment.recipe.test.length > 0
        ? 'Pendiente de ejecutar suite docente del profesor.'
        : 'No existe suite docente activa; tests omitidos.';
    state.observedEvidence.runtime.healthcheckSummary =
      assessment.recipe.healthcheck !== null
        ? 'Pendiente de ejecutar según receta activa.'
        : 'La receta activa no propuso healthcheck.';

    state.runtimeOutputs.stackResult = {
      ...this.builderRunSupportService.buildStackResult({
        runtimeFiles,
        assessment,
        model,
        preflightSummary,
      }),
      preflight: preflightSummary,
    };
  }

  private applyTeacherTestSuitePolicy(
    planResult: BuilderLlmPhaseResult,
    hasTeacherTests: boolean,
  ): void {
    if (!hasTeacherTests) {
      planResult.assessment.recipe.test = [];
      return;
    }

    planResult.assessment.recipe.test = [
      ['pytest', '-q', '/app/.dockus/teacher-tests'],
    ];
    if (
      !planResult.assessment.recipe.install.some(
        (command) =>
          command.join(' ') === 'python -m pip install pytest' ||
          command.join(' ') === 'pip install pytest' ||
          command.join(' ') === 'pip3 install pytest',
      )
    ) {
      planResult.assessment.recipe.install.push([
        'python',
        '-m',
        'pip',
        'install',
        'pytest',
      ]);
    }
  }

  private async persistPlanningArtifacts(
    runId: string,
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    staticReviewIssues: StaticReviewIssue[],
    planResult: BuilderLlmPhaseResult,
    preflightSummary: BuilderPreflightSummary,
    state: BuilderRuntimeState,
  ): Promise<void> {
    const preflightArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.PREFLIGHT,
      preflightSummary,
    );
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
    const staticReviewArtifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.STATIC_REVIEW,
      {
        issues: staticReviewIssues,
        warnings: state.staticReviewWarnings,
      },
    );

    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      preflightArtifact,
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
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      staticReviewArtifact,
    );

    const analysisStageResult = state.stageResults[0];
    analysisStageResult.evidenceRefs = [
      `artifact:${preflightArtifact.id}`,
      `artifact:${planningArtifact.id}`,
      `artifact:${recipeArtifact.id}`,
      `artifact:${findingsArtifact.id}`,
      `artifact:${staticReviewArtifact.id}`,
    ];
    await this.builderRunSupportService.emitStageFinished(
      runId,
      BuildRunStatus.ANALYZING,
      analysisStageResult,
    );
  }

  private async evaluateRepairDecision(input: {
    run: BuildRun;
    attemptNumber: number;
    delivery: Delivery;
    workspaceNetworkName: string;
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    currentAssessment: BuilderPipelineOutcome['llmAssessment'];
    staticFindings: BuilderPipelineOutcome['staticFindings'];
    staticReviewIssues: StaticReviewIssue[];
    executionNetworkName: string | null;
    imageTag: string | null;
    state: BuilderRuntimeState;
  }): Promise<RepairDecision> {
    if (input.attemptNumber >= this.selfHealMaxAttempts) {
      return { shouldRetry: false, nextAssessment: null, traceEntry: null };
    }

    const latestBuild = this.builderRunSupportService.latestStageResult(
      input.state.stageResults,
      BuildStage.BUILD,
    );
    const latestDeploy = this.builderRunSupportService.latestStageResult(
      input.state.stageResults,
      BuildStage.DEPLOY,
    );

    let triggerStage: BuildStage | null = null;
    let triggerReasonCode = '';
    let triggerSummary = '';
    if (latestBuild?.status === StageStatus.FAIL) {
      triggerStage = BuildStage.BUILD;
      triggerReasonCode = latestBuild.reasonCode;
      triggerSummary = 'El build de la imagen Docker falló.';
    } else if (latestDeploy?.status === StageStatus.FAIL) {
      await this.builderValidationStageService.collectRuntimeEvents({
        run: input.run,
        workspaceNetworkName: input.workspaceNetworkName,
        executionNetworkName: input.executionNetworkName,
        state: input.state,
      });
      const hasRuntimeEvidence =
        Boolean(input.state.currentAttemptDiagnostics.containerLogs) ||
        Boolean(input.state.currentAttemptDiagnostics.containerInspect) ||
        Boolean(input.state.currentAttemptDiagnostics.runtimeEvents);
      if (hasRuntimeEvidence) {
        triggerStage = BuildStage.DEPLOY;
        triggerReasonCode = latestDeploy.reasonCode;
        triggerSummary = 'El contenedor no arrancó correctamente en Docker.';
      }
    }

    if (!triggerStage || !this.builderRepairLlmService.isEnabled()) {
      return { shouldRetry: false, nextAssessment: null, traceEntry: null };
    }

    try {
      const repaired = await this.builderRunSupportService.runLlmPhaseWithRetry(
        'repair',
        input.state.warnings,
        async () => {
          const result = await this.builderRepairLlmService.repair({
            projectRootDir: input.projectRootDir,
            runtimeFiles: input.runtimeFiles,
            assessment: input.currentAssessment,
            staticFindings: input.staticFindings,
            staticReviewIssues: input.staticReviewIssues,
            failureStage: triggerStage,
            failureReasonCode: triggerReasonCode,
            buildLogText: input.state.currentAttemptDiagnostics.buildLogText,
            containerLogs: input.state.currentAttemptDiagnostics.containerLogs,
            containerInspect:
              input.state.currentAttemptDiagnostics.containerInspect,
            runtimeEvents: input.state.currentAttemptDiagnostics.runtimeEvents,
            priorRepairAttempts: input.state.selfHealingTrace.length,
          });
          if (!result) {
            throw new ServiceUnavailableException(
              'El repair LLM no devolvió una receta corregida.',
            );
          }
          return result;
        },
      );

      const recipeDiff = this.builderRunSupportService.diffRecipes(
        input.currentAssessment.recipe,
        repaired.assessment.recipe,
      );
      const traceEntry = this.buildSelfHealingTraceEntry({
        attemptNumber: input.attemptNumber,
        triggerStage,
        triggerReasonCode,
        triggerSummary,
        recipeDiff,
        outcome: recipeDiff.length > 0 ? 'repaired' : 'unchanged',
        state: input.state,
      });

      if (recipeDiff.length === 0) {
        return {
          shouldRetry: false,
          nextAssessment: null,
          traceEntry,
        };
      }

      return {
        shouldRetry: true,
        nextAssessment: repaired.assessment,
        traceEntry,
      };
    } catch (error) {
      return {
        shouldRetry: false,
        nextAssessment: null,
        traceEntry: this.buildSelfHealingTraceEntry({
          attemptNumber: input.attemptNumber,
          triggerStage,
          triggerReasonCode,
          triggerSummary,
          recipeDiff: [],
          outcome: 'llm_failed',
          state: input.state,
        }),
      };
    }
  }

  private buildSelfHealingTraceEntry(input: {
    attemptNumber: number;
    triggerStage: BuildStage;
    triggerReasonCode: string;
    triggerSummary: string;
    recipeDiff: string[];
    outcome: BuilderSelfHealingAttempt['outcome'];
    state: BuilderRuntimeState;
  }): BuilderSelfHealingAttempt {
    return {
      attemptNumber: input.attemptNumber,
      triggerStage: input.triggerStage,
      triggerReasonCode: input.triggerReasonCode,
      triggerSummary: input.triggerSummary,
      recipeChanged: input.recipeDiff.length > 0,
      recipeDiff: input.recipeDiff,
      outcome: input.outcome,
      diagnostics: {
        buildLogTail: input.state.currentAttemptDiagnostics.buildLogTail,
        containerLogTail: input.state.currentAttemptDiagnostics.containerLogTail,
        errorHints: this.builderRunSupportService.buildSelfHealingHints({
          buildLogText: input.state.currentAttemptDiagnostics.buildLogText,
          containerLogs: input.state.currentAttemptDiagnostics.containerLogs,
          containerInspect:
            input.state.currentAttemptDiagnostics.containerInspect,
          runtimeEvents: input.state.currentAttemptDiagnostics.runtimeEvents,
        }),
      },
    };
  }

  private async cleanupAttemptResources(
    run: BuildRun,
    workspaceNetworkName: string,
    executionNetworkName: string | null,
    imageTag: string | null,
    state: BuilderRuntimeState,
  ): Promise<void> {
    if (executionNetworkName) {
      await this.builderCleanupStageService.run({
        run,
        workspaceNetworkName,
        executionNetworkName,
        state,
      });
    }
    if (imageTag) {
      await this.builderRunSupportService.cleanupImage(
        imageTag,
        state.warnings,
      );
    }
  }

  private async persistSelfHealingTrace(
    runId: string,
    state: BuilderRuntimeState,
  ): Promise<void> {
    if (state.selfHealingTrace.length === 0) {
      return;
    }

    const artifact = await this.evidenceService.persistJsonArtifact(
      runId,
      BuildRunArtifactType.SELF_HEALING_TRACE,
      state.selfHealingTrace,
    );
    await this.builderRunSupportService.recordArtifact(
      runId,
      state.evidenceArtifacts,
      artifact,
    );
  }

  private async runEvaluationPhase(
    planningAssessment: BuilderPipelineOutcome['llmAssessment'],
    executionContext: BuilderPipelineOutcome['executionContext'],
    state: BuilderInternalState,
    staticFindings: BuilderPipelineOutcome['staticFindings'],
    staticReviewIssues: StaticReviewIssue[],
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
          staticReviewIssues,
          warnings: state.warnings,
          executionContext,
          evidenceArtifacts: state.evidenceArtifacts.map((artifact) => ({
            id: artifact.id,
            type: artifact.type,
          })),
          observedEvidence: state.observedEvidence,
          assignmentContext: state.assignmentContext,
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

  private async runTechnicalFeedbackPhase(input: {
    assessment: BuilderPipelineOutcome['llmAssessment'];
    runtimeFiles: RuntimeFile[];
    state: BuilderRuntimeState;
    staticFindings: BuilderPipelineOutcome['staticFindings'];
    staticReviewIssues: StaticReviewIssue[];
    runId: string;
  }): Promise<BuilderTechnicalFeedback> {
    if (!this.builderTechnicalFeedbackLlmService.isEnabled()) {
      return {
        security: [],
        architecture: [],
        quality: [],
        rubricCompliance: [],
      };
    }

    try {
      return await this.builderRunSupportService.runLlmPhaseWithRetry(
        'technical_feedback',
        input.state.warnings,
        () =>
          this.builderTechnicalFeedbackLlmService.generate({
            assessment: input.assessment,
            runtimeFiles: input.runtimeFiles,
            stageResults: input.state.stageResults,
            staticFindings: input.staticFindings,
            staticReviewIssues: input.staticReviewIssues,
            warnings: input.state.warnings,
            assignmentContext: (input.state as BuilderInternalState)
              .assignmentContext,
          }),
      );
    } catch (error) {
      await this.builderRunSupportService.recordWarning(
        input.runId,
        input.state.warnings,
        `No se pudo generar feedback técnico multidimensional: ${this.builderRunSupportService.toErrorMessage(error)}`,
      );
      return {
        security: [],
        architecture: [],
        quality: [],
        rubricCompliance: [],
      };
    }
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

  private cloneAssessment(
    assessment: BuilderPipelineOutcome['llmAssessment'],
  ): BuilderPipelineOutcome['llmAssessment'] {
    return JSON.parse(
      JSON.stringify(assessment),
    ) as BuilderPipelineOutcome['llmAssessment'];
  }

  private async recordPreflightWarnings(
    runId: string,
    warnings: string[],
    preflightSummary: BuilderPreflightSummary,
  ): Promise<void> {
    for (const finding of preflightSummary.findings) {
      if (finding.level === 'info') {
        continue;
      }

      await this.builderRunSupportService.recordWarning(
        runId,
        warnings,
        `[${finding.code}] ${finding.message}`,
      );
    }
  }

  private async completeUnsupportedPreflight(input: {
    runId: string;
    runtimeFiles: RuntimeFile[];
    preflightSummary: BuilderPreflightSummary;
    executionContext: BuilderPipelineOutcome['executionContext'];
    state: BuilderRuntimeState;
  }): Promise<BuilderPipelineOutcome> {
    const analysisStarted = this.builderRunSupportService.beginStage(
      BuildStage.ANALYSIS,
    );
    await this.builderRunSupportService.emitStageStarted(
      input.runId,
      BuildRunStatus.ANALYZING,
      BuildStage.ANALYSIS,
    );

    const preflightArtifact = await this.evidenceService.persistJsonArtifact(
      input.runId,
      BuildRunArtifactType.PREFLIGHT,
      input.preflightSummary,
    );
    await this.builderRunSupportService.recordArtifact(
      input.runId,
      input.state.evidenceArtifacts,
      preflightArtifact,
    );

    const analysisStageResult = this.builderRunSupportService.finishStage({
      stage: BuildStage.ANALYSIS,
      startedAt: analysisStarted.startedAt,
      status: StageStatus.FAIL,
      reasonCode:
        input.preflightSummary.failureCode ??
        'PREFLIGHT_UNSUPPORTED_PROJECT_TYPE',
      evidenceRefs: [`artifact:${preflightArtifact.id}`],
    });
    input.state.stageResults.push(analysisStageResult);
    await this.builderRunSupportService.emitStageFinished(
      input.runId,
      BuildRunStatus.ANALYZING,
      analysisStageResult,
      {
        compatibility: input.preflightSummary.compatibility,
        supportedProjectType: input.preflightSummary.supportedProjectType,
      },
    );

    const assessment = this.buildUnsupportedPreflightAssessment(
      input.preflightSummary,
    );
    input.state.observedEvidence.workspaceSummary =
      this.buildPreflightSummaryText(input.preflightSummary);
    input.state.observedEvidence.runtime.mode = 'analysis_only';
    input.state.observedEvidence.runtime.deploySummary =
      'No desplegado porque el preflight rechazó la entrega antes del build.';
    input.state.observedEvidence.runtime.probeSummary =
      'No ejecutado por rechazo temprano en preflight.';
    input.state.observedEvidence.runtime.stabilitySummary =
      'No ejecutado por rechazo temprano en preflight.';
    input.state.observedEvidence.runtime.testSummary = input.preflightSummary
      .testsPresent
      ? 'Se detectaron tests, pero el preflight bloqueó el pipeline antes de ejecutarlos.'
      : 'Sin tests detectados; el preflight bloqueó el pipeline antes de ejecutar la suite docente.';
    input.state.observedEvidence.runtime.healthcheckSummary =
      'No ejecutado por rechazo temprano en preflight.';
    input.state.runtimeOutputs.stackResult = {
      ...this.builderRunSupportService.buildStackResult({
        runtimeFiles: input.runtimeFiles,
        assessment,
        model: 'preflight-only',
        preflightSummary: input.preflightSummary,
      }),
      preflight: input.preflightSummary,
    };
    input.state.runtimeOutputs.timingsMs =
      this.builderRunSupportService.toTimings(input.state.stageResults);

    const report = this.builderReportService.create({
      assessment,
      stageResults: input.state.stageResults,
      relevantEvidence: input.state.evidenceArtifacts.map(
        (artifact) => artifact.id,
      ),
      technicalFeedback: {
        security: [],
        architecture: [],
        quality: [],
        rubricCompliance: [],
      },
      selfHealingTrace: [],
    });
    await this.persistReportArtifacts(input.runId, report, input.state);

    return {
      preflightSummary: input.preflightSummary,
      llmAssessment: assessment,
      staticFindings: [],
      staticReviewIssues: [],
      stageResults: input.state.stageResults,
      evidenceArtifacts: input.state.evidenceArtifacts,
      report,
      executionContext: input.executionContext,
      runtimeOutputs: input.state.runtimeOutputs,
      failureReason:
        input.preflightSummary.failureCode ??
        'PREFLIGHT_UNSUPPORTED_PROJECT_TYPE',
      warnings: input.state.warnings,
    };
  }

  private buildUnsupportedPreflightAssessment(
    preflightSummary: BuilderPreflightSummary,
  ): BuilderPipelineOutcome['llmAssessment'] {
    const rationale =
      preflightSummary.findings[0]?.message ??
      'El preflight determinó que la entrega no encaja en la matriz Python-first soportada.';

    return {
      structuralType: `PREFLIGHT_${preflightSummary.supportedProjectType}`,
      capabilities: {
        C1: {
          status: 'unknown',
          rationale:
            'La ejecución se detuvo antes de validar la estructura completa del proyecto.',
        },
        C2: {
          status: 'no',
          rationale:
            'No se ejecutó build porque la entrega fue rechazada en preflight.',
        },
        C3: {
          status: 'no',
          rationale:
            'No se desplegó ningún servicio porque la entrega fue rechazada en preflight.',
        },
        C4: {
          status: 'no',
          rationale:
            'No se ejecutó la validación runtime al detenerse el pipeline antes del despliegue.',
        },
        C5: {
          status: preflightSummary.testsPresent ? 'unknown' : 'no',
          rationale: preflightSummary.testsPresent
            ? 'Hay indicios de tests, pero no se ejecutaron por rechazo temprano.'
            : 'No se detectaron tests y el pipeline no continuó.',
        },
        C6: {
          status: 'no',
          rationale:
            'La entrega no alcanzó el mínimo evaluable por incompatibilidad detectada en preflight.',
        },
      },
      evaluativeState: 'E4',
      confidence: 'high',
      rationale,
      externalRequirements: [],
      recipe: {
        install: [],
        run: null,
        test: [],
        healthcheck: null,
        servicePort: null,
        systemPackages: [],
        workingDirectory: preflightSummary.workingDirectory,
        dependencyManager: preflightSummary.dependencyManager,
        executionProfile: preflightSummary.executionProfile,
        manifestSource: preflightSummary.manifestSource,
        environment: {},
      },
      evidenceSummary: this.buildPreflightSummaryText(preflightSummary),
      observedEvidence: preflightSummary.findings.map(
        (finding) => finding.message,
      ),
      evaluationLimits: [
        'El pipeline se detuvo en preflight antes del plan LLM completo.',
      ],
    };
  }

  private buildPreflightSummaryText(
    preflightSummary: BuilderPreflightSummary,
  ): string {
    const framework =
      preflightSummary.detectedFramework ?? 'sin framework claro';
    const compatibilityMap: Record<string, string> = {
      SUPPORTED_AUTO: 'soportado automáticamente',
      SUPPORTED_WITH_MANIFEST: 'soportado mediante dockus.yml',
      PARTIAL: 'parcial',
      UNSUPPORTED: 'no soportado',
    };
    const compatibility =
      compatibilityMap[preflightSummary.compatibility] ??
      preflightSummary.compatibility.toLowerCase();
    return `Preflight ${compatibility} para ${preflightSummary.supportedProjectType} (${framework}).`;
  }
}
