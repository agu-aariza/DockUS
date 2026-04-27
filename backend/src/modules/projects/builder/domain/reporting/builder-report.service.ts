import { Injectable } from '@nestjs/common';
import {
  BuildStage,
  BuilderLlmAssessment,
  BuilderReport,
  BuilderSelfHealingAttempt,
  BuilderSelfHealingSummary,
  BuilderTechnicalFeedback,
  StageResult,
  StageStatus,
  TechnicalFeedbackAxis,
} from '../builder.types';

@Injectable()
export class BuilderReportService {
  create(input: {
    assessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    relevantEvidence: string[];
    technicalFeedback: BuilderTechnicalFeedback;
    selfHealingTrace: BuilderSelfHealingAttempt[];
  }): BuilderReport {
    const stageOutcome = this.toStageOutcome(input.stageResults);
    const overallOutcome = this.toOverallOutcome(
      input.assessment,
      stageOutcome,
    );
    const llmRecommendations = this.toRecommendations(
      input.assessment,
      input.technicalFeedback,
      overallOutcome,
    );
    const selfHealing = this.toSelfHealingSummary(
      input.selfHealingTrace,
      input.stageResults,
    );
    const readableText = this.toReadableText({
      assessment: input.assessment,
      stageOutcome,
      relevantEvidence: input.relevantEvidence,
      llmRecommendations,
      technicalFeedback: input.technicalFeedback,
      selfHealing,
    });

    return {
      ...input.assessment,
      overallOutcome,
      llmRecommendations,
      technicalFeedback: input.technicalFeedback,
      selfHealing,
      readableText,
      stageOutcome,
      relevantEvidence: input.relevantEvidence,
    };
  }

  private toReadableText(input: {
    assessment: BuilderLlmAssessment;
    stageOutcome: Record<BuildStage, StageStatus>;
    relevantEvidence: string[];
    llmRecommendations: string[];
    technicalFeedback: BuilderTechnicalFeedback;
    selfHealing: BuilderSelfHealingSummary;
  }): string {
    const sections = [
      `Tipo estructural final: ${input.assessment.structuralType}.`,
      `Estado evaluativo final: ${input.assessment.evaluativeState}.`,
      `Confianza declarada por el evaluador LLM: ${input.assessment.confidence}.`,
      `Racional principal: ${input.assessment.rationale}`,
      `Capacidades: ${this.describeCapabilities(input.assessment)}`,
      `Resumen de evidencia: ${input.assessment.evidenceSummary}`,
      `Resultado por etapa: ${Object.entries(input.stageOutcome)
        .map(([stage, status]) => `${stage}=${status}`)
        .join(', ')}.`,
      `Autocorrección: ${input.selfHealing.summary}`,
      `Seguridad: ${this.describeTechnicalAxis(input.technicalFeedback.security)}`,
      `Arquitectura: ${this.describeTechnicalAxis(input.technicalFeedback.architecture)}`,
      `Calidad: ${this.describeTechnicalAxis(input.technicalFeedback.quality)}`,
      `Recomendaciones: ${
        input.llmRecommendations.length > 0
          ? input.llmRecommendations.join(' | ')
          : 'sin acciones adicionales sugeridas'
      }.`,
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
      `Evidencias asociadas: ${
        input.relevantEvidence.length > 0
          ? input.relevantEvidence.join(', ')
          : 'sin artefactos persistidos'
      }.`,
    ];

    return sections.join('\n');
  }

  private describeCapabilities(assessment: BuilderLlmAssessment): string {
    return Object.entries(assessment.capabilities)
      .map(
        ([capabilityId, capability]) =>
          `${capabilityId}=${capability.status} (${capability.rationale})`,
      )
      .join('; ');
  }

  private describeTechnicalAxis(
    items: BuilderTechnicalFeedback[TechnicalFeedbackAxis],
  ): string {
    if (items.length === 0) {
      return 'sin observaciones relevantes';
    }

    return items
      .slice(0, 3)
      .map((item) =>
        [
          item.title,
          item.file ? `${item.file}${item.line ? `:${item.line}` : ''}` : null,
        ]
          .filter(Boolean)
          .join(' @ '),
      )
      .join(' | ');
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

  private toOverallOutcome(
    assessment: BuilderLlmAssessment,
    stageOutcome: Record<BuildStage, StageStatus>,
  ): BuilderReport['overallOutcome'] {
    const hardFailureStages = [
      BuildStage.BUILD,
      BuildStage.DEPLOY,
      BuildStage.PROBES,
      BuildStage.STABILITY,
      BuildStage.TESTS,
    ];
    if (
      assessment.evaluativeState === 'E4' ||
      hardFailureStages.some(
        (stage) => stageOutcome[stage] === StageStatus.FAIL,
      )
    ) {
      return 'FAIL';
    }

    if (
      assessment.evaluativeState === 'E1' &&
      hardFailureStages.every(
        (stage) => stageOutcome[stage] !== StageStatus.FAIL,
      )
    ) {
      return 'PASS';
    }

    if (
      assessment.evaluativeState === 'E2' ||
      assessment.evaluativeState === 'E3'
    ) {
      return 'PARTIAL';
    }

    return 'UNKNOWN';
  }

  private toRecommendations(
    assessment: BuilderLlmAssessment,
    technicalFeedback: BuilderTechnicalFeedback,
    overallOutcome: BuilderReport['overallOutcome'],
  ): string[] {
    const recommendations = new Set<string>([
      ...assessment.externalRequirements,
      ...assessment.evaluationLimits,
    ]);

    for (const axis of [
      ...technicalFeedback.security,
      ...technicalFeedback.architecture,
      ...technicalFeedback.quality,
    ]) {
      recommendations.add(axis.detail);
    }

    if (overallOutcome === 'FAIL') {
      recommendations.add(
        'Revisar primero los fallos de build/despliegue antes de interpretar el resto del resultado.',
      );
    }

    return [...recommendations].filter(Boolean).slice(0, 8);
  }

  private toSelfHealingSummary(
    trace: BuilderSelfHealingAttempt[],
    stageResults: StageResult[],
  ): BuilderSelfHealingSummary {
    const attempted = trace.length > 0;
    const attemptsUsed = attempted
      ? Math.max(...trace.map((attempt) => attempt.attemptNumber)) + 1
      : 1;
    const latestBuild = this.latestStageStatus(stageResults, BuildStage.BUILD);
    const latestDeploy = this.latestStageStatus(
      stageResults,
      BuildStage.DEPLOY,
    );
    const recovered =
      attempted &&
      trace.some((attempt) => attempt.outcome === 'repaired') &&
      latestBuild !== StageStatus.FAIL &&
      latestDeploy !== StageStatus.FAIL;

    return {
      attempted,
      recovered,
      attemptsUsed,
      summary: !attempted
        ? 'No fue necesario reintentar el pipeline.'
        : recovered
          ? `Se aplicó autocorrección y el pipeline continuó tras ${attemptsUsed} intentos.`
          : `Se intentó autocorrección sin recuperar completamente el pipeline tras ${attemptsUsed} intentos.`,
    };
  }

  private latestStageStatus(
    stageResults: StageResult[],
    stage: BuildStage,
  ): StageStatus {
    for (let index = stageResults.length - 1; index >= 0; index -= 1) {
      if (stageResults[index].stage === stage) {
        return stageResults[index].status;
      }
    }
    return StageStatus.SKIP;
  }
}
