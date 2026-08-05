/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-fallback-assessment.util).
 *
 * @module builder-fallback-assessment.util
 */

import { Logger } from '@nestjs/common';
import {
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  BuilderExecutionResult,
  BuilderPlanContractV2,
  BuilderLlmStageTrace,
  BUILDER_LLM_SCHEMA_VERSION,
} from '../../../domain/builder.types';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import { BuilderCodeQualityTrace } from '../ai/builder-code-quality.service';
import { BuilderHallucinationGuard } from '../evaluation/builder-hallucination-guard.service';

const logger = new Logger('BuilderFallbackAssessment');

export function requireParsedContract<
  TContract extends BuilderPlanContractV2 | BuilderEvaluationContractV2,
>(trace: BuilderLlmStageTrace<TContract>): TContract {
  if (trace.parsedContract) {
    return trace.parsedContract;
  }

  throw new Error(
    trace.error?.message ??
      `No se pudo obtener una salida valida para la etapa ${trace.stage}.`,
  );
}

function buildFallbackObservedEvidence(
  execution: BuilderExecutionResult,
  errorMessage: string,
): string[] {
  // opera sobre stdout/stderr estructurados en vez de re-parsear el
  // blob de texto — ya no hace falta filtrar las lineas "STDOUT:"/"STDERR:"/
  // "EXIT CODE: 0" porque, sin el blob, esas lineas nunca existieron.
  const lines = `${execution.stdout}\n${execution.stderr}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const interestingLines: string[] = [];
  for (const line of lines) {
    if (
      /error|denied|failed|exit code|traceback|warning/iu.test(line) &&
      !interestingLines.includes(line)
    ) {
      interestingLines.push(line);
    }
    if (interestingLines.length >= 2) {
      break;
    }
  }

  const fallbackLine =
    lines.find((line) => !interestingLines.includes(line)) ??
    'Se registraron logs de ejecucion para la corrida.';

  return [
    `El evaluador LLM devolvió un contrato inválido: ${errorMessage}`,
    interestingLines[0] ?? fallbackLine,
    interestingLines[1] ??
      `Longitud de logs capturados: ${serializeExecutionResult(execution).length} caracteres.`,
  ];
}

function buildFallbackEvaluationLimits(
  execution: BuilderExecutionResult,
  errorMessage: string,
): string[] {
  const limits = [`Contrato inválido del evaluador LLM: ${errorMessage}`];

  if (execution.exitCode !== null && execution.exitCode !== 0) {
    limits.push(
      `La ejecución terminó con fallo: EXIT CODE: ${execution.exitCode}`,
    );
  }

  return limits;
}

/**
 * Coherencia entre el estado y el desglose de nota. El evaluador tiende a emitir
 * E2 por inercia, y un E2 con la rúbrica entera al máximo se contradice a sí
 * mismo: el informe acaba diciendo "funcionó con fallos" y "Necesita mejoras"
 * sobre una entrega de 10. Cuando no hay una sola deducción, la evidencia del
 * propio contrato dice E1.
 *
 * Solo corrige en esa dirección. Un E1 con puntos descontados es legítimo: el
 * estado describe si el programa hizo lo que se esperaba, no si la rúbrica
 * repartió todos los puntos (se pueden perder por estructura o estilo sin que
 * la ejecución fallase).
 */
function reconcileStateWithGradeBreakdown(
  contract: BuilderEvaluationContractV2,
): void {
  if (contract.evaluativeState !== 'E2') {
    return;
  }

  const breakdown = contract.gradeBreakdown;
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return;
  }

  const hasDeductions = breakdown.some((item) => item.awarded < item.maxPoints);
  if (hasDeductions) {
    return;
  }

  logger.warn(
    JSON.stringify({
      event: 'builder_eval_state_reconciled',
      from: 'E2',
      to: 'E1',
      reason: 'grade_breakdown_sin_deducciones',
    }),
  );
  contract.evaluativeState = 'E1';
}

export function resolveEvaluationAssessment(
  trace: BuilderLlmStageTrace<BuilderEvaluationContractV2>,
  planAssessment: BuilderPlanContractV2,
  execution: BuilderExecutionResult,
  expectedOutput: string | null,
  guard: BuilderHallucinationGuard,
): BuilderEvaluationContractV2 {
  if (trace.parsedContract) {
    const hallucinationWarning = guard.detectOutputHallucination(
      trace.parsedContract,
      execution,
      expectedOutput,
    );
    if (hallucinationWarning) {
      logger.warn(
        JSON.stringify({
          event: 'builder_eval_hallucination_detected',
          warning: hallucinationWarning,
          originalState: trace.parsedContract.evaluativeState,
        }),
      );
      trace.parsedContract.evaluationLimits = [
        ...trace.parsedContract.evaluationLimits,
        hallucinationWarning,
      ];
      if (
        trace.parsedContract.evaluativeState === 'E1' ||
        trace.parsedContract.evaluativeState === 'E2'
      ) {
        trace.parsedContract.evaluativeState = 'E3';
        trace.parsedContract.confidence = 'low';
      }
    }
    reconcileStateWithGradeBreakdown(trace.parsedContract);
    return trace.parsedContract;
  }

  const errorMessage =
    trace.error?.message ??
    'El evaluador LLM devolvio una salida invalida sin detalle adicional.';
  logger.warn(
    JSON.stringify({
      event: 'builder_llm_stage_degraded',
      stage: 'evaluation',
      reason: trace.error?.code ?? 'invalid_contract',
      message: errorMessage,
    }),
  );
  const observedEvidence = buildFallbackObservedEvidence(
    execution,
    errorMessage,
  );
  const evaluationLimits = buildFallbackEvaluationLimits(
    execution,
    errorMessage,
  );

  return {
    schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
    stage: 'evaluation',
    thought:
      'Evaluacion degradada por salida invalida del evaluador LLM. Se conserva la evidencia operativa para debugging.',
    structuralType: planAssessment.structuralType,
    capabilities: planAssessment.capabilities,
    // E4, no E3: aquí el que falló fue el evaluador, no la entrega. El programa
    // del alumno puede haber funcionado perfectamente. E3 significa "el programa
    // no produjo salida evaluable" y etiquetarlo así sería mentirle al alumno.
    // Ambos estados siguen mapeando a FAIL y al mismo tope de nota, así que el
    // resultado no cambia: cambia lo que el informe dice que pasó.
    evaluativeState: 'E4',
    confidence: 'low',
    rationale: `El evaluador LLM devolvio un contrato invalido: ${errorMessage}`,
    recommendedGrade: undefined,
    gradeBreakdown: [],
    studentSummary:
      'No se pudo generar un resumen porque el evaluador automatico fallo. Tu profesor revisara la entrega manualmente.',
    teacherSummary: `Evaluacion degradada. El evaluador LLM devolvio un contrato invalido: ${errorMessage}. Revision manual recomendada.`,
    externalRequirements: planAssessment.externalRequirements,
    runtime: planAssessment.runtime,
    recipe: planAssessment.recipe,
    evidenceSummary:
      'Evaluación degradada por salida inválida del evaluador LLM. Revisa los artefactos LLM_EVAL_* y los logs de ejecución.',
    observedEvidence,
    evaluationLimits,
  };
}

export function buildEmptyCodeQualityContract(
  thought: string,
): BuilderCodeQualityContractV2 {
  return {
    thought,
    security: [],
    architecture: [],
    quality: [],
    rubricCompliance: [],
  };
}

export function resolveCodeQualityFindings(
  trace: BuilderCodeQualityTrace,
): BuilderCodeQualityContractV2 {
  if (trace.parsedContract) {
    return trace.parsedContract;
  }

  logger.warn(
    JSON.stringify({
      event: 'builder_llm_stage_degraded',
      stage: 'quality',
      reason: trace.error?.code ?? 'invalid_contract',
      message:
        trace.error?.message ??
        'El modelo de calidad devolvio una salida invalida sin detalle adicional.',
    }),
  );

  return {
    thought:
      'Análisis degradado por salida inválida del modelo de calidad. Revisa los artefactos LLM_QUALITY_* para debugging.',
    security: [],
    architecture: [],
    quality: [],
    rubricCompliance: [],
  };
}
