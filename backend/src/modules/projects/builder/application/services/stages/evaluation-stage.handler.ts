import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderLlmEvaluatorService } from '../../../domain/ai/builder-llm-evaluator.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuilderHallucinationGuard } from '../evaluation/builder-hallucination-guard.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderFactsContractV2,
  BuilderPlanContractV2,
} from '../../../domain/builder.types';
import { resolveEvaluationAssessment } from '../support/builder-fallback-assessment.util';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';
import { toStageTokenUsage } from '../../../domain/ai/builder-llm-trace.util';
import type { BuilderStageTokenUsage } from '../../../domain/builder.types';

interface EvaluationStageInput {
  runId: string;
  workspace: StageWorkspaceResult;
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
  planAssessment: BuilderPlanContractV2;
}

interface EvaluationStageOutput {
  assessment: BuilderEvaluationContractV2;
  usages: BuilderStageTokenUsage[];
}

@Injectable()
export class BuilderEvaluationStageHandler implements IBuilderStageHandler<
  EvaluationStageInput,
  EvaluationStageOutput
> {
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
      executionLogs,
      assignmentContext,
      planAssessment,
    } = input;

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'LOG_CHUNK',
      runStatus: BuildRunStatus.RUNNING,
      message: 'Auditoria final del LLM...',
      payload: { studentStage: 'evaluating' },
    });

    const factsTrace =
      await this.builderLlmEvaluatorService.extractFactsWithTrace(
        {
          sourceCodePayload,
          executionLogs,
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
      this.createFallbackFacts(executionLogs, assignmentContext.expectedOutput);

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
      executionLogs,
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
    executionLogs: string,
    expectedOutput: string | null,
  ): BuilderFactsContractV2 {
    return {
      schemaVersion: 'builder-llm/v2',
      stage: 'facts',
      thought:
        'Fallback: no se pudo extraer hechos estructurados. Se devuelve un resumen mínimo.',
      observedStdout: [],
      observedStderr: [],
      exitCode: null,
      compilationStatus: 'not_applicable',
      matchesOracle: false,
      discrepancies: expectedOutput
        ? ['No se pudo verificar la salida contra el oráculo.']
        : [],
      filesPresent: [],
      executionSummary: executionLogs.slice(0, 500),
      evidenceLimits: [
        'Fallback: el extractor de hechos falló. La evaluación continúa con logs en bruto truncados.',
      ],
    };
  }
}
