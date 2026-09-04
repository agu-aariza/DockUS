/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-evaluation-contract.parser).
 *
 * @module builder-evaluation-contract.parser
 */

import {
  BuilderEvaluationContractV2,
  BuilderRecipeV2,
  BuilderRuntimeDescriptorV2,
  RubricGradeItem,
} from '../builder.types';
import {
  normalizeConfidence,
  normalizeObservedEvidence,
  normalizeOptionalString,
  normalizeSchemaVersion,
  normalizeStage,
  normalizeString,
  normalizeStringArray,
  parseRawContract,
  normalizeEvaluativeState,
} from './parsers/contract-parser.utils';
import {
  alignCapabilitiesWithRecipe,
  normalizeCapabilities,
  normalizeRecipe,
  normalizeRuntimeDescriptor,
} from './parsers/plan-contract.parser';
import {
  normalizeGrade,
  assertEvaluationSemanticConsistency,
  assertGradeStateConsistency,
  maxGradeForEvaluativeState,
} from './parsers/evaluation-contract.parser';

export function parseBuilderEvaluationContractV2(
  raw: string,
): BuilderEvaluationContractV2 {
  const sourceName = 'evaluador LLM';
  const object = parseRawContract(raw, sourceName);

  const contract: BuilderEvaluationContractV2 = {
    schemaVersion: normalizeSchemaVersion(object.schemaVersion, sourceName),
    stage: normalizeStage(object.stage, 'evaluation', sourceName),
    thought: normalizeOptionalString(
      object.thought,
      'thought',
      'Sin razonamiento previo documentado.',
    ),
    structuralType: normalizeString(object.structuralType, 'structuralType'),
    capabilities: normalizeCapabilities(object.capabilities),
    evaluativeState: normalizeEvaluativeState(
      object.evaluativeState,
      sourceName,
    ),
    confidence: normalizeConfidence(object.confidence, sourceName),
    rationale: normalizeOptionalString(
      object.rationale,
      'rationale',
      'Sin justificación detallada.',
    ),
    recommendedGrade: normalizeGrade(object.recommendedGrade),
    externalRequirements: normalizeStringArray(
      object.externalRequirements,
      'externalRequirements',
    ),
    runtime: safeNormalizeRuntimeDescriptor(object.runtime, sourceName),
    recipe: safeNormalizeRecipe(object.recipe, sourceName),
    evidenceSummary: normalizeOptionalString(
      object.evidenceSummary,
      'evidenceSummary',
      '',
    ),
    observedEvidence: normalizeObservedEvidence(object.observedEvidence),
    evaluationLimits: normalizeStringArray(
      object.evaluationLimits,
      'evaluationLimits',
    ),
    gradeBreakdown: normalizeGradeBreakdown(object.gradeBreakdown),
    studentSummary: normalizeOptionalString(
      object.studentSummary,
      'studentSummary',
      'No se genero resumen para el alumno.',
    ),
    teacherSummary: normalizeOptionalString(
      object.teacherSummary,
      'teacherSummary',
      'No se genero resumen para el profesor.',
    ),
  };

  // la señal de truncamiento es que la clave falte por completo del
  // JSON parseado (el LLM se quedó sin tokens antes de emitirla) — no que
  // safeNormalizeRuntimeDescriptor/safeNormalizeRecipe hayan atrapado una
  // excepción. Antes ambas condiciones colapsaban en el mismo catch-all, así
  // que un `runtime`/`recipe` presente pero inválido (p.ej. `null`, o un
  // objeto sin forma) se etiquetaba igual que uno genuinamente truncado, y
  // eso bastaba para desactivar assertEvaluationSemanticConsistency más abajo.
  // Con la comprobación movida a "¿existe la clave?", un valor presente pero
  // inválido ya no se confunde con truncamiento: normalizeRuntimeDescriptor/
  // normalizeRecipe lo rechazan de verdad (ver safeNormalizeRuntimeDescriptor/
  // safeNormalizeRecipe más abajo), como cualquier otro campo mal formado del
  // contrato.
  const wasTruncated =
    object.runtime === undefined || object.recipe === undefined;

  if (wasTruncated) {
    contract.evaluationLimits = [
      ...contract.evaluationLimits,
      'TRUNCATED: La respuesta del evaluador fue truncada (posible loop de repetición). Los campos runtime/recipe/observedEvidence pueden estar incompletos.',
    ];
    contract.confidence = 'low';
  }

  // `gradeBreakdown` es la fuente de verdad verificable. El total se recalcula
  // para corregir posibles errores aritméticos del LLM.
  let breakdownMaxTotal = 0;
  let breakdownUsesNonDecimalScale = false;
  if (contract.gradeBreakdown.length > 0) {
    const awarded = contract.gradeBreakdown.reduce(
      (sum, item) => sum + item.awarded,
      0,
    );
    const maxTotal = contract.gradeBreakdown.reduce(
      (sum, item) =>
        sum + (Number.isFinite(item.maxPoints) ? item.maxPoints : 0),
      0,
    );

    // El desglose puede venir en otra escala que la 0-10 (el caso típico: el
    // modelo puntúa cada criterio sobre el peso porcentual de la rúbrica, y la
    // suma se acerca a 100). Reescalar preserva la proporción; recortar a 10 sin
    // más convertiría cualquier desglose en un sobresaliente, y en silencio.
    const usesNonDecimalScale = maxTotal > 0 && Math.abs(maxTotal - 10) > 0.5;
    const computed = usesNonDecimalScale ? (awarded / maxTotal) * 10 : awarded;
    breakdownMaxTotal = maxTotal;
    breakdownUsesNonDecimalScale = usesNonDecimalScale;

    if (usesNonDecimalScale) {
      contract.evaluationLimits = [
        ...contract.evaluationLimits,
        `RESCALED: el desglose sumaba ${roundToTwoDecimals(maxTotal)} puntos máximos; la nota se reescaló a la escala 0-10.`,
      ];
    }

    if (computed > 10 || computed < 0) {
      contract.evaluationLimits = [
        ...contract.evaluationLimits,
        `GRADE_OUT_OF_RANGE: la suma del desglose (${roundToTwoDecimals(computed)}) queda fuera de la escala 0-10 y se ha recortado.`,
      ];
      contract.confidence = 'low';
    }

    contract.recommendedGrade = roundToTwoDecimals(
      Math.min(10, Math.max(0, computed)),
    );
  }

  // El modelo puede entender E3/E4 correctamente y aun así dejar una nota
  // residual de criterios estáticos por encima del límite. No descartamos por
  // completo ese contrato (lo que provocaba `invalid_contract` y una
  // evaluación degradada): conservamos la evidencia, reducimos la nota a la
  // zona suspensa y dejamos una marca explícita para revisión docente.
  const maximumGrade = maxGradeForEvaluativeState(contract.evaluativeState);
  if (
    contract.recommendedGrade !== undefined &&
    contract.recommendedGrade > maximumGrade
  ) {
    const inconsistentGrade = contract.recommendedGrade;

    if (contract.gradeBreakdown.length > 0) {
      contract.gradeBreakdown = capGradeBreakdown(
        contract.gradeBreakdown,
        maximumGrade,
        breakdownMaxTotal,
        breakdownUsesNonDecimalScale,
      );
      const cappedAwarded = contract.gradeBreakdown.reduce(
        (sum, item) => sum + item.awarded,
        0,
      );
      const cappedComputed =
        breakdownUsesNonDecimalScale && breakdownMaxTotal > 0
          ? (cappedAwarded / breakdownMaxTotal) * 10
          : cappedAwarded;
      contract.recommendedGrade = roundToTwoDecimals(
        Math.min(maximumGrade, Math.max(0, cappedComputed)),
      );
    } else {
      contract.recommendedGrade = maximumGrade;
    }

    contract.evaluationLimits = [
      ...contract.evaluationLimits,
      `INVALID_CONTRACT_REPAIRED: evaluativeState=${contract.evaluativeState} llegó con recommendedGrade=${inconsistentGrade}, por encima del máximo ${maximumGrade}; el backend la ajustó a ${contract.recommendedGrade} y requiere revisión manual.`,
    ];
    contract.confidence = 'low';
  }

  contract.capabilities = alignCapabilitiesWithRecipe(
    contract.capabilities,
    contract.recipe,
  );

  // esta invariante (E3/E4 ⇒ nota ≤2) no depende de recipe/
  // capabilities/observedEvidence, así que se exige siempre — incluso si el
  // contrato se marcó truncado. Es la única defensa real contra que un
  // veredicto de "no apto" conviva con una nota aprobatoria.
  assertGradeStateConsistency(
    contract.evaluativeState,
    contract.recommendedGrade,
  );

  // El resto de comprobaciones semánticas (evidencia mínima, coherencia
  // capability↔recipe) sí puede omitirse si el contrato está genuinamente
  // truncado: exigirlas produciría falsos rechazos sobre campos que el LLM
  // nunca llegó a emitir.
  if (!wasTruncated) {
    assertEvaluationSemanticConsistency(
      contract.capabilities,
      contract.recipe,
      contract.observedEvidence,
    );
  }

  return contract;
}

/**
 * Eval JSON may be truncated when the LLM enters a repetition loop
 * and exhausts numPredict before emitting runtime/recipe.
 * Instead of crashing, fall back to sensible defaults so we can still
 * surface the gradeBreakdown, studentSummary, etc. that were parsed.
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function capGradeBreakdown(
  items: RubricGradeItem[],
  targetGrade: number,
  maxTotal: number,
  usesNonDecimalScale: boolean,
): RubricGradeItem[] {
  const safeMaxTotal = finiteNonNegative(maxTotal);
  const awardedTotal = items.reduce(
    (sum, item) => sum + finiteNonNegative(item.awarded),
    0,
  );
  const targetInBreakdownScale =
    usesNonDecimalScale && safeMaxTotal > 0
      ? (targetGrade / 10) * safeMaxTotal
      : targetGrade;
  const targetAwarded = roundToTwoDecimals(
    Math.min(safeMaxTotal, Math.max(0, targetInBreakdownScale)),
  );

  if (awardedTotal <= 0 || targetAwarded <= 0) {
    return rebalanceGradeBreakdown(
      items.map((item) => ({
        ...item,
        maxPoints: finiteNonNegative(item.maxPoints),
        awarded: 0,
      })),
      0,
    );
  }

  const scale = Math.min(1, targetAwarded / awardedTotal);
  const scaledItems = items.map((item) => {
    const maxPoints = finiteNonNegative(item.maxPoints);
    const awarded = finiteNonNegative(item.awarded);
    return {
      ...item,
      maxPoints,
      awarded: roundToTwoDecimals(
        Math.min(maxPoints, Math.max(0, awarded * scale)),
      ),
    };
  });

  // Trabajar en centésimas evita que el redondeo independiente de cada
  // criterio vuelva a romper la igualdad recommendedGrade = suma(awarded).
  return rebalanceGradeBreakdown(scaledItems, targetAwarded);
}

function rebalanceGradeBreakdown(
  items: RubricGradeItem[],
  targetTotal: number,
): RubricGradeItem[] {
  const capacityCents = items.reduce(
    (sum, item) => sum + toCents(item.maxPoints),
    0,
  );
  const targetCents = Math.min(
    capacityCents,
    Math.max(0, Math.round(targetTotal * 100)),
  );
  const awardedCents = items.map((item) =>
    Math.min(toCents(item.maxPoints), toCents(item.awarded)),
  );
  const currentCents = awardedCents.reduce((sum, value) => sum + value, 0);

  if (currentCents > targetCents) {
    let remaining = currentCents - targetCents;
    for (
      let index = awardedCents.length - 1;
      index >= 0 && remaining > 0;
      index -= 1
    ) {
      const reduction = Math.min(awardedCents[index], remaining);
      awardedCents[index] -= reduction;
      remaining -= reduction;
    }
  } else if (currentCents < targetCents) {
    let remaining = targetCents - currentCents;
    for (
      let index = 0;
      index < awardedCents.length && remaining > 0;
      index += 1
    ) {
      const capacity = Math.max(
        0,
        toCents(items[index].maxPoints) - awardedCents[index],
      );
      const addition = Math.min(capacity, remaining);
      awardedCents[index] += addition;
      remaining -= addition;
    }
  }

  return items.map((item, index) => ({
    ...item,
    awarded: awardedCents[index] / 100,
  }));
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toCents(value: number): number {
  return Math.round(finiteNonNegative(value) * 100);
}

/**
 * Solo aplica el valor por defecto ("ausente por truncamiento") cuando la clave
 * falta de verdad (`value === undefined`). Un valor presente pero mal formado
 * propaga su error real, igual que cualquier otro campo del contrato.
 */
function safeNormalizeRuntimeDescriptor(
  value: unknown,
  sourceName: string,
): BuilderRuntimeDescriptorV2 {
  if (value === undefined) {
    return {
      family: 'unknown',
      version: null,
      supported: false,
      reason:
        'runtime ausente en respuesta del evaluador (posible truncamiento por agotamiento de tokens).',
    };
  }

  return normalizeRuntimeDescriptor(value, sourceName);
}

/** mismo criterio que safeNormalizeRuntimeDescriptor. */
function safeNormalizeRecipe(
  value: unknown,
  sourceName: string,
): BuilderRecipeV2 {
  if (value === undefined) {
    return {
      install: [],
      run: null,
      test: [],
      systemPackages: [],
      cwd: null,
      environment: null,
      service: null,
    };
  }

  return normalizeRecipe(value, sourceName);
}

function normalizeGradeBreakdown(value: unknown): RubricGradeItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    const criterion =
      typeof candidate.criterion === 'string' ? candidate.criterion.trim() : '';
    const maxPoints =
      typeof candidate.maxPoints === 'number' ? candidate.maxPoints : 0;
    const awarded =
      typeof candidate.awarded === 'number' ? candidate.awarded : 0;
    const justification =
      typeof candidate.justification === 'string'
        ? candidate.justification.trim()
        : '';

    if (!criterion) return [];

    return [
      {
        criterion,
        maxPoints: Math.max(0, maxPoints),
        awarded: Math.max(0, Math.min(awarded, maxPoints || awarded)),
        justification: justification || 'Sin justificación.',
      },
    ];
  });
}
