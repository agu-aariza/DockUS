import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderLlmEvaluatorService } from '../../../domain/ai/builder-llm-evaluator.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  BuilderPlanContractV2,
  AssignmentContext,
} from '../../../domain/builder.types';
import { requireParsedContract } from '../support/builder-fallback-assessment.util';

interface PlanStageInput {
  runId: string;
  sourceCodePayload: string;
  assignmentContext: AssignmentContext;
}

interface PlanStageOutput {
  planAssessment: BuilderPlanContractV2;
}

@Injectable()
export class BuilderPlanStageHandler implements IBuilderStageHandler<
  PlanStageInput,
  PlanStageOutput
> {
  constructor(
    private readonly builderLlmEvaluatorService: BuilderLlmEvaluatorService,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async handle(input: PlanStageInput): Promise<PlanStageOutput> {
    const { runId, sourceCodePayload, assignmentContext } = input;

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.RUNNING,
      message: 'Analizando arquitectura del proyecto con IA...',
      payload: { studentStage: 'building' },
    });

    const planTrace = await this.builderLlmEvaluatorService.planWithTrace(
      {
        sourceCodePayload,
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
      planTrace,
    );
    const planAssessment = requireParsedContract(planTrace);

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.RUNNING,
      message: `Plan generado: ${planAssessment.structuralType} (Confianza: ${planAssessment.confidence})`,
      payload: { studentStage: 'building' },
    });

    return { planAssessment };
  }
}
