/**
 * @fileoverview Motor Builder de evaluación asíncrona (report-stage.handler).
 *
 * @module report-stage.handler
 */

import { Injectable, Logger } from '@nestjs/common';
import { BuilderPedagogicalService } from '../evaluation/builder-pedagogical.service';
import { BuilderReportComposer } from '../evaluation/builder-report-composer.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderLlmEvaluatorService } from '../ai/builder-llm-evaluator.service';
import {
  BuilderEvaluationContractV3,
  BuilderCodeQualityContractV2,
  BuilderExecutionResult,
  BuilderReportEntity,
  BuilderStageTokenUsage,
} from '../../../domain/builder.types';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { toStageTokenUsage } from '../ai/builder-llm-trace.util';
import { buildReportCopyFallback } from '../support/builder-report-copy-fallback.util';

interface ReportStageInput {
  runId: string;
  assessment: BuilderEvaluationContractV3;
  qualityFindings: BuilderCodeQualityContractV2;
  execution: BuilderExecutionResult;
}

interface ReportStageOutput {
  report: BuilderReportEntity;
  usages: BuilderStageTokenUsage[];
}

@Injectable()
export class BuilderReportStageHandler {
  private readonly logger = new Logger(BuilderReportStageHandler.name);
  constructor(
    private readonly builderPedagogicalService: BuilderPedagogicalService,
    private readonly builderReportComposer: BuilderReportComposer,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
    private readonly builderLlmEvaluatorService: BuilderLlmEvaluatorService,
  ) {}

  async handle(input: ReportStageInput): Promise<ReportStageOutput> {
    const { runId, assessment, qualityFindings, execution } = input;

    const pedagogicalFeedback = this.builderPedagogicalService.generateFeedback(
      serializeExecutionResult(execution),
    );
    const pedagogicalItems =
      this.builderPedagogicalService.toTechnicalFeedbackItems(
        pedagogicalFeedback,
      );
    const reportingStartedAt = Date.now();
    let reportingTrace: Awaited<
      ReturnType<BuilderLlmEvaluatorService['reportWithTrace']>
    > | null = null;
    let unexpectedError: string | null = null;
    try {
      reportingTrace = await this.builderLlmEvaluatorService.reportWithTrace(
        assessment,
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
        reportingTrace,
      );
    } catch (error) {
      unexpectedError = error instanceof Error ? error.message : String(error);
      await this.builderArtifactPersister.persistJsonArtifact(
        runId,
        BuildRunArtifactType.LLM_REPORT_ERROR,
        { stage: 'reporting', code: 'internal_error', error: unexpectedError },
        'Error reporting persistido para debugging.',
      );
    }
    const usedFallback = !reportingTrace?.parsedContract;
    const copy =
      reportingTrace?.parsedContract ?? buildReportCopyFallback(assessment);
    this.logger.log(
      JSON.stringify({
        event: 'builder_reporting_metrics',
        runId,
        latencyMs: Date.now() - reportingStartedAt,
        contractInvalid: reportingTrace?.error?.code === 'invalid_contract',
        usedFallback,
        inputTokens: reportingTrace?.usage?.inputTokens ?? null,
        outputTokens: reportingTrace?.usage?.outputTokens ?? null,
        providerId: reportingTrace?.modelProfile.providerId ?? null,
        modelId: reportingTrace?.modelProfile.modelId ?? null,
      }),
    );
    const report = this.builderReportComposer.composeReportV3(
      assessment,
      copy,
      qualityFindings,
      pedagogicalItems,
      {
        usedFallback,
        errorCode:
          reportingTrace?.error?.code ??
          (unexpectedError ? 'internal_error' : null),
      },
    );

    await this.builderArtifactPersister.persistJsonArtifact(
      runId,
      BuildRunArtifactType.REPORT_JSON,
      report,
      'Informe canonico del run generado.',
    );

    const usage = toStageTokenUsage(reportingTrace);
    return { report, usages: usage ? [usage] : [] };
  }
}
