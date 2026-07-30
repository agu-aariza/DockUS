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

  // AIP-001: la señal de truncamiento es que la clave falte por completo del
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

  // gradeBreakdown is the auditable source of truth.
  // Override recommendedGrade with its sum to correct LLM arithmetic errors.
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

  contract.capabilities = alignCapabilitiesWithRecipe(
    contract.capabilities,
    contract.recipe,
  );

  // AIP-001: esta invariante (E3/E4 ⇒ nota ≤2) no depende de recipe/
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

/**
 * AIP-001: solo aplica el valor por defecto ("ausente por truncamiento")
 * cuando la clave falta de verdad (`value === undefined`). Antes se atrapaba
 * cualquier excepción de `normalizeRuntimeDescriptor` — incluida la que
 * lanza para un `runtime` presente pero inválido (`null`, objeto sin forma,
 * familia desconocida) — y se le daba el mismo tratamiento que a un campo
 * genuinamente truncado. Un valor presente pero mal formado ahora propaga su
 * error real, igual que cualquier otro campo del contrato.
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

/** AIP-001: mismo criterio que safeNormalizeRuntimeDescriptor. */
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
