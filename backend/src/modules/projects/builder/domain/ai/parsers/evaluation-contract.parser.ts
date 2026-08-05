/**
 * @fileoverview Motor Builder de evaluación asíncrona (evaluation-contract.parser).
 *
 * @module evaluation-contract.parser
 */

import type {
  BuilderCapabilityMap,
  BuilderRecipeV2,
  EvaluativeState,
} from '../../builder.types';

/**
 * El propio prompt del evaluador exige esta correlación ("Logs solo de
 * compilación: evaluativeState=E3, recommendedGrade≤2") pero solo como guía
 * de prompt — nada la hacía cumplir. E3/E4 se traducen a `overallOutcome`
 * FAIL para el alumno; sin esta comprobación el informe podía mostrar
 * "APTO" (E1/E2) junto a una nota suspensa, o "NO APTO" junto a un 9/10.
 */
const MAX_GRADE_FOR_FAILING_STATE = 2;

export function normalizeGrade(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;

  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error('recommendedGrade debe ser numérico.');
  }

  const clamped = Math.max(0, Math.min(10, parsed));
  return Math.round(clamped * 100) / 100;
}

/**
 * La comprobación se mantiene separada de `assertEvaluationSemanticConsistency`
 * porque esta invariante no depende de `recipe`/`capabilities`/
 * `observedEvidence`, campos que un contrato genuinamente truncado puede no haber emitido. Por
 * eso debe exigirse siempre, incluso cuando el contrato se marca truncado y
 * el resto de comprobaciones semánticas se omite; de lo contrario un
 * `runtime`/`recipe` inválido (no ausente) bastaba para desactivar la única
 * regla que impide "E3/E4 con nota aprobatoria".
 */
export function assertGradeStateConsistency(
  evaluativeState: EvaluativeState,
  recommendedGrade: number | undefined,
): void {
  if (
    recommendedGrade !== undefined &&
    (evaluativeState === 'E3' || evaluativeState === 'E4') &&
    recommendedGrade > MAX_GRADE_FOR_FAILING_STATE
  ) {
    throw new Error(
      `evaluativeState=${evaluativeState} es incompatible con recommendedGrade=${recommendedGrade} (máximo ${MAX_GRADE_FOR_FAILING_STATE}).`,
    );
  }
}

export function assertEvaluationSemanticConsistency(
  capabilities: BuilderCapabilityMap,
  recipe: BuilderRecipeV2,
  observedEvidence: string[],
): void {
  if (observedEvidence.length < 1) {
    throw new Error(
      'observedEvidence debe incluir al menos 1 evidencia concreta.',
    );
  }

  if (capabilities.C3.status === 'yes' && recipe.service === null) {
    throw new Error('C3=yes requiere recipe.service.');
  }

  if (
    capabilities.C5.status === 'yes' &&
    recipe.service?.healthcheck === null
  ) {
    throw new Error('C5=yes requiere recipe.service.healthcheck.');
  }
}
