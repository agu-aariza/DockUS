import { Injectable } from '@nestjs/common';
import {
  BuildStage,
  BuilderLlmAssessment,
  BuilderReport,
  StageResult,
  StageStatus,
} from '../builder.types';

@Injectable()
export class BuilderReportService {
  create(input: {
    assessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    relevantEvidence: string[];
  }): BuilderReport {
    const stageOutcome = this.toStageOutcome(input.stageResults);
    const readableText = [
      `Tipo estructural final: ${input.assessment.structuralType}.`,
      `Estado evaluativo final: ${input.assessment.evaluativeState}.`,
      `Confianza declarada por el evaluador LLM: ${input.assessment.confidence}.`,
      `Racional principal: ${input.assessment.rationale}`,
      `Capacidades: ${this.describeCapabilities(input.assessment)}`,
      `Resumen de evidencia: ${input.assessment.evidenceSummary}`,
      `Evidencia observada: ${
        input.assessment.observedEvidence.length > 0
          ? input.assessment.observedEvidence.join(' | ')
          : 'sin evidencia adicional sintetizada'
      }.`,
      `Límites de evaluación: ${
        input.assessment.evaluationLimits.length > 0
          ? input.assessment.evaluationLimits.join(' | ')
          : 'sin límites adicionales declarados'
      }.`,
      `Requisitos/configuración externa: ${
        input.assessment.externalRequirements.length > 0
          ? input.assessment.externalRequirements.join(' | ')
          : 'no declarados'
      }.`,
      `Resultado por etapa: ${Object.entries(stageOutcome)
        .map(([stage, status]) => `${stage}=${status}`)
        .join(', ')}.`,
      `Evidencias asociadas: ${
        input.relevantEvidence.length > 0
          ? input.relevantEvidence.join(', ')
          : 'sin artefactos persistidos'
      }.`,
    ].join('\n');

    return {
      ...input.assessment,
      readableText,
      stageOutcome,
      relevantEvidence: input.relevantEvidence,
    };
  }

  private describeCapabilities(assessment: BuilderLlmAssessment): string {
    return Object.entries(assessment.capabilities)
      .map(([capabilityId, capability]) => {
        return `${capabilityId}=${capability.status} (${capability.rationale})`;
      })
      .join('; ');
  }

  private toStageOutcome(
    stageResults: StageResult[],
  ): Record<BuildStage, StageStatus> {
    const stageOutcome: Record<BuildStage, StageStatus> = {
      [BuildStage.ANALYSIS]: StageStatus.SKIP,
      [BuildStage.BUILD]: StageStatus.SKIP,
      [BuildStage.DEPLOY]: StageStatus.SKIP,
      [BuildStage.PROBES]: StageStatus.SKIP,
      [BuildStage.STABILITY]: StageStatus.SKIP,
      [BuildStage.TESTS]: StageStatus.SKIP,
      [BuildStage.CLEANUP]: StageStatus.SKIP,
    };

    for (const stageResult of stageResults) {
      stageOutcome[stageResult.stage] = stageResult.status;
    }

    return stageOutcome;
  }
}
