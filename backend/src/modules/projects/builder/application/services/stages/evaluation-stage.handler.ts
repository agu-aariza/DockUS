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
  BuilderPlanContractV2,
} from '../../../domain/builder.types';
import { resolveEvaluationAssessment } from '../support/builder-fallback-assessment.util';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';

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

    const evaluationTrace =
      await this.builderLlmEvaluatorService.evaluateWithTrace(
        {
          projectRootDir: workspace.projectRootDir,
          sourceCodePayload,
          executionLogs,
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

    return { assessment };
  }
}
