/**
 * @fileoverview Motor Builder de evaluación asíncrona (evaluation-stage.handler).
 *
 * @module evaluation-stage.handler
 */

import { Injectable } from '@nestjs/common';
import { BuilderLlmEvaluatorService } from '../ai/builder-llm-evaluator.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuilderHallucinationGuard } from '../evaluation/builder-hallucination-guard.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderEvaluationContractV3,
  BuilderExecutionResult,
  BuilderFactsContractV2,
  BuilderPlanContractV2,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import { resolveEvaluationAssessment } from '../support/builder-fallback-assessment.util';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';
import { toStageTokenUsage } from '../ai/builder-llm-trace.util';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import type { BuilderStageTokenUsage } from '../../../domain/builder.types';

interface EvaluationStageInput {
  runId: string;
  workspace: StageWorkspaceResult;
  sourceCodePayload: string;
  execution: BuilderExecutionResult;
  assignmentContext: AssignmentContext;
  planAssessment: BuilderPlanContractV2;
}

interface EvaluationStageOutput {
  assessment: BuilderEvaluationContractV3;
  usages: BuilderStageTokenUsage[];
}

@Injectable()
export class BuilderEvaluationStageHandler {
  constructor(
    private readonly builderLlmEvaluatorService: BuilderLlmEvaluatorService,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderHallucinationGuard: BuilderHallucinationGuard,
  ) {}

  async handle(input: EvaluationStageInput): Promise<EvaluationStageOutput> {
    const {
      runId,
      workspace,
      sourceCodePayload,
      execution,
      assignmentContext,
      planAssessment,
    } = input;

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'LOG_CHUNK',
      runStatus: BuildRunStatus.RUNNING,
      message: 'Auditoria final del LLM...',
      payload: { studentStage: 'evaluating' satisfies BuilderStudentStage },
    });

    const factsTrace =
      await this.builderLlmEvaluatorService.extractFactsWithTrace(
        {
          sourceCodePayload,
          execution,
          assignmentContext,
        },
        {
          onBeforeCall: async (snapshot) => {
            await this.builderArtifactPersister.persistPromptArtifact(
              runId,
              snapshot,
            );
          },
        },
      );
    await this.builderArtifactPersister.persistStageTraceArtifacts(
      runId,
      factsTrace,
    );

    const facts =
      factsTrace.parsedContract ??
      this.createFallbackFacts(execution, assignmentContext.expectedOutput);

    const evaluationTrace =
      await this.builderLlmEvaluatorService.evaluateWithTrace(
        {
          projectRootDir: workspace.projectRootDir,
          sourceCodePayload,
          facts,
          assignmentContext,
          plannerAssessment: planAssessment,
        },
        {
          onBeforeCall: async (snapshot) => {
            await this.builderArtifactPersister.persistPromptArtifact(
              runId,
              snapshot,
            );
          },
        },
      );
    await this.builderArtifactPersister.persistStageTraceArtifacts(
      runId,
      evaluationTrace,
    );
    const assessment = resolveEvaluationAssessment(
      evaluationTrace,
      planAssessment,
      execution,
      assignmentContext.expectedOutput ?? null,
      this.builderHallucinationGuard,
    );

    return {
      assessment,
      usages: [factsTrace, evaluationTrace]
        .map(toStageTokenUsage)
        .filter((usage): usage is BuilderStageTokenUsage => usage !== null),
    };
  }

  private createFallbackFacts(
    execution: BuilderExecutionResult,
    expectedOutput: string | null,
  ): BuilderFactsContractV2 {
    return {
      schemaVersion: 'builder-llm/v2',
      stage: 'facts',
      thought:
        'Fallback: no se pudo extraer hechos estructurados. Se devuelve un resumen mínimo.',
      observedStdout: [],
      observedStderr: [],
      exitCode: execution.exitCode,
      compilationStatus: 'not_applicable',
      matchesOracle: false,
      discrepancies: expectedOutput
        ? ['No se pudo verificar la salida contra el oráculo.']
        : [],
      filesPresent: [],
      executionSummary: serializeExecutionResult(execution).slice(0, 500),
      evidenceLimits: [
        'Fallback: el extractor de hechos falló. La evaluación continúa con logs en bruto truncados.',
      ],
    };
  }
}
