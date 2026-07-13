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

  // Detect truncation: if runtime or recipe fell back to defaults,
  // mark the contract so downstream code knows the eval was partial.
  const wasTruncated =
    contract.runtime.reason?.includes('truncamiento') ||
    (contract.recipe.run === null &&
      contract.recipe.install.length === 0 &&
      object.recipe === undefined);

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
      (sum, item) => sum + (Number.isFinite(item.maxPoints) ? item.maxPoints : 0),
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

  // Skip strict semantic consistency check if the response was truncated,
  // since missing fields would cause false assertion failures.
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

function safeNormalizeRuntimeDescriptor(
  value: unknown,
  sourceName: string,
): BuilderRuntimeDescriptorV2 {
  try {
    return normalizeRuntimeDescriptor(value, sourceName);
  } catch {
    return {
      family: 'unknown',
      version: null,
      supported: false,
      reason:
        'runtime ausente en respuesta del evaluador (posible truncamiento por agotamiento de tokens).',
    };
  }
}

function safeNormalizeRecipe(
  value: unknown,
  sourceName: string,
): BuilderRecipeV2 {
  try {
    return normalizeRecipe(value, sourceName);
  } catch {
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
