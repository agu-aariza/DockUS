import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderPedagogicalService } from '../evaluation/builder-pedagogical.service';
import { BuilderReportComposer } from '../evaluation/builder-report-composer.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderEvaluationContractV2, BuilderCodeQualityContractV2, BuilderReportEntity } from '../../../domain/builder.types';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';

export interface ReportStageInput {
  runId: string;
  assessment: BuilderEvaluationContractV2;
  qualityFindings: BuilderCodeQualityContractV2;
  executionLogs: string;
}

export interface ReportStageOutput {
  report: BuilderReportEntity;
}

@Injectable()
export class BuilderReportStageHandler implements IBuilderStageHandler<ReportStageInput, ReportStageOutput> {
  constructor(
    private readonly builderPedagogicalService: BuilderPedagogicalService,
    private readonly builderReportComposer: BuilderReportComposer,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
  ) {}

  async handle(input: ReportStageInput): Promise<ReportStageOutput> {
    const { runId, assessment, qualityFindings, executionLogs } = input;

    const pedagogicalFeedback =
      this.builderPedagogicalService.generateFeedback(executionLogs);
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
