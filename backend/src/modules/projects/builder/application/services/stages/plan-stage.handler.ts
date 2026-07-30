/**
 * @fileoverview Motor Builder de evaluación asíncrona (plan-stage.handler).
 *
 * @module plan-stage.handler
 */

import { Injectable } from '@nestjs/common';
import { BuilderLlmEvaluatorService } from '../ai/builder-llm-evaluator.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  BuilderPlanContractV2,
  AssignmentContext,
  BuilderStageTokenUsage,
} from '../../../domain/builder.types';
import { requireParsedContract } from '../support/builder-fallback-assessment.util';
import { toStageTokenUsage } from '../ai/builder-llm-trace.util';

interface PlanStageInput {
  runId: string;
  sourceCodePayload: string;
  assignmentContext: AssignmentContext;
}

interface PlanStageOutput {
  planAssessment: BuilderPlanContractV2;
  usages: BuilderStageTokenUsage[];
}

@Injectable()
export class BuilderPlanStageHandler {
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

    const usage = toStageTokenUsage(planTrace);
    return { planAssessment, usages: usage ? [usage] : [] };
  }
}
