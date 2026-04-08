import { Injectable } from '@nestjs/common';
import {
  BuildStage,
  StageResult,
  StageStatus,
  StrategyResult,
  TeacherReport,
} from '../builder.types';

@Injectable()
export class TeacherReportService {
  create(input: {
    detectedProject: TeacherReport['detectedProject'];
    strategyResult: StrategyResult;
    stageResults: StageResult[];
    failureReason: string | null;
    relevantEvidence: string[];
  }): TeacherReport {
    const stageOutcome = this.toStageOutcome(input.stageResults);
    const failed = input.stageResults.find(
      (stageResult) => stageResult.status === StageStatus.FAIL,
    );
    const exactCause =
      input.failureReason ??
      (failed
        ? `Fallo en etapa ${failed.stage} (${failed.reasonCode}).`
        : 'Evaluación completada correctamente en entorno controlado.');
    const strategyApplied = this.buildStrategyDescription(input.strategyResult);
    const evaluationImplication = failed
      ? 'No cumple la validación técnica mínima de DockUS.'
      : 'Cumple la validación técnica mínima de DockUS.';
    const readableText = [
      `Proyecto detectado: ${input.detectedProject}.`,
      `Estrategia aplicada: ${strategyApplied}.`,
      `Resultado por etapa: ${Object.entries(stageOutcome)
        .map(([stage, status]) => `${stage}=${status}`)
        .join(', ')}.`,
      `Causa exacta: ${exactCause}`,
      `Evidencias relevantes: ${
        input.relevantEvidence.length > 0
          ? input.relevantEvidence.join(', ')
          : 'sin evidencia adicional'
      }.`,
      `Implicación para evaluación técnica: ${evaluationImplication}`,
    ].join('\n');

    return {
      detectedProject: input.detectedProject,
      strategyApplied,
      stageOutcome,
      exactCause,
      relevantEvidence: input.relevantEvidence,
      evaluationImplication,
      readableText,
    };
  }

  private toStageOutcome(
    stageResults: StageResult[],
  ): Record<BuildStage, StageStatus> {
    const defaultStatus: Record<BuildStage, StageStatus> = {
      [BuildStage.ANALYSIS]: StageStatus.SKIP,
      [BuildStage.BUILD]: StageStatus.SKIP,
      [BuildStage.DEPLOY]: StageStatus.SKIP,
      [BuildStage.PROBES]: StageStatus.SKIP,
      [BuildStage.STABILITY]: StageStatus.SKIP,
      [BuildStage.TESTS]: StageStatus.SKIP,
      [BuildStage.CLEANUP]: StageStatus.SKIP,
    };
    for (const stageResult of stageResults) {
      defaultStatus[stageResult.stage] = stageResult.status;
    }
    return defaultStatus;
  }

  private buildStrategyDescription(strategyResult: StrategyResult): string {
    const parts = [
      `clase=${strategyResult.selectedClass}`,
      `build=${strategyResult.build.mode}`,
      `perfil=${strategyResult.execution.profile}`,
      `template=${strategyResult.build.dockerTemplate}`,
    ];
    if (strategyResult.blockingConditions.length > 0) {
      parts.push(`bloqueos=${strategyResult.blockingConditions.join('|')}`);
    }
    return parts.join(', ');
  }
}
