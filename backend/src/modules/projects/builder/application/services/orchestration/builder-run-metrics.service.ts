/**
 * @fileoverview Métricas de ejecución del builder.
 *
 * Contexto:
 * - Separa el registro de métricas de negocio del servicio de comandos,
 *   permitiendo evolucionar el formato de los logs sin tocar la orquestación.
 *
 * @module BuilderRunMetricsService
 */

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BuilderRunMetricsService {
  private readonly logger = new Logger(BuilderRunMetricsService.name);

  logRunMetrics(
    runId: string,
    promptVersion: string,
    assessment: {
      recommendedGrade?: number;
      gradeBreakdown?: { awarded: number }[];
      evaluativeState?: string;
      confidence?: string;
    },
    qualityFindings: unknown,
  ): void {
    const computedGrade =
      assessment.gradeBreakdown?.reduce((sum, item) => sum + item.awarded, 0) ??
      null;
    const recommendedGrade = assessment.recommendedGrade ?? null;
    const gradeMismatch =
      computedGrade !== null &&
      recommendedGrade !== null &&
      Math.abs(computedGrade - recommendedGrade) > 0.01;

    this.logger.log(
      JSON.stringify({
        event: 'builder_run_metrics',
        runId,
        promptVersion,
        evaluativeState: assessment.evaluativeState ?? null,
        confidence: assessment.confidence ?? null,
        recommendedGrade,
        computedGrade,
        gradeMismatch,
        qualityFindingCount: Array.isArray(qualityFindings)
          ? qualityFindings.length
          : null,
      }),
    );
  }
}
