import { Injectable } from '@nestjs/common';
import type {
  BuilderPipelineOutcome,
  BuilderPreflightSummary,
  RuntimeFile,
} from '../../domain/builder.types';
import {
  buildAssessmentFromPreflightSummary,
  detectBuilderPreflightSummary,
  isDirectlyRunnablePreflight,
} from '../../infrastructure/utils/builder-analysis.util';
import { BuilderRunSupportService } from './builder-run-support.service';

@Injectable()
export class BuilderPreflightService {
  constructor(
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async detect(runtimeFiles: RuntimeFile[]): Promise<BuilderPreflightSummary> {
    return detectBuilderPreflightSummary(runtimeFiles);
  }

  isFastPath(summary: BuilderPreflightSummary): boolean {
    return isDirectlyRunnablePreflight(summary);
  }

  buildFastPathPlan(summary: BuilderPreflightSummary): {
    model: string;
    assessment: BuilderPipelineOutcome['llmAssessment'];
  } {
    return {
      model:
        summary.compatibility === 'SUPPORTED_WITH_MANIFEST'
          ? 'dockus-manifest'
          : 'preflight-auto',
      assessment: buildAssessmentFromPreflightSummary(summary),
    };
  }

  async recordWarnings(
    runId: string,
    warnings: string[],
    summary: BuilderPreflightSummary,
  ): Promise<void> {
    for (const finding of summary.findings) {
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
}
