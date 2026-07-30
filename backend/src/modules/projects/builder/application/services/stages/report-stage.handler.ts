/**
 * @fileoverview Motor Builder de evaluación asíncrona (report-stage.handler).
 *
 * @module report-stage.handler
 */

import { Injectable } from '@nestjs/common';
import { BuilderPedagogicalService } from '../evaluation/builder-pedagogical.service';
import { BuilderReportComposer } from '../evaluation/builder-report-composer.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import {
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  BuilderExecutionResult,
  BuilderReportEntity,
} from '../../../domain/builder.types';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';

interface ReportStageInput {
  runId: string;
  assessment: BuilderEvaluationContractV2;
  qualityFindings: BuilderCodeQualityContractV2;
  execution: BuilderExecutionResult;
}

interface ReportStageOutput {
  report: BuilderReportEntity;
}

@Injectable()
export class BuilderReportStageHandler {
  constructor(
    private readonly builderPedagogicalService: BuilderPedagogicalService,
    private readonly builderReportComposer: BuilderReportComposer,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
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
    const report = this.builderReportComposer.composeReport(
      assessment,
      qualityFindings,
      pedagogicalItems,
    );

    await this.builderArtifactPersister.persistJsonArtifact(
      runId,
      BuildRunArtifactType.REPORT_JSON,
      report,
      'Informe canonico del run generado.',
    );

    return { report };
  }
}
