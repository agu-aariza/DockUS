import {
  BUILDER_EVALUATION_SCHEMA_VERSION,
  BuilderCriterionAssessmentV3,
  BuilderEvaluationContractV3,
  BuilderEvaluationEvidenceV3,
  BuilderEvaluationFindingV3,
  BuilderCriterionStatus,
  FindingSeverity,
} from '../builder.types';
import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';
import {
  normalizeString,
  normalizeStringArray,
  parseRawContract,
} from './parsers/contract-parser.utils';

type JsonObject = Record<string, unknown>;

/**
 * Parser estricto del contrato de evaluación v3.
 *
 * El modelo entrega contenido y referencias por posición. Los identificadores
 * y la visibilidad se calculan aquí para que nunca queden bajo control del LLM.
 */
export function parseBuilderEvaluationContractV3(
  raw: string,
): BuilderEvaluationContractV3 {
  const object = parseRawContract(raw, 'evaluador LLM v3');
  if (object.schemaVersion !== BUILDER_EVALUATION_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion inválido en evaluador LLM v3. Se esperaba ${BUILDER_EVALUATION_SCHEMA_VERSION}.`,
    );
  }
  if (
    'studentSummary' in object ||
    'teacherSummary' in object ||
    'gradeBreakdown' in object
  ) {
    throw new Error(
      'La evaluación v3 no admite narrativa por audiencia ni gradeBreakdown; use criteria y la etapa reporting.',
    );
  }

  const rawEvidence = normalizeObjectArray(object.evidence, 'evidence');
  const evidence = rawEvidence.map((entry, index) =>
    normalizeEvidence(entry, index),
  );
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const rawCriteria = normalizeObjectArray(object.criteria, 'criteria');
  if (rawCriteria.length === 0) {
    throw new Error('criteria debe contener al menos un criterio evaluado.');
  }

  const validRawCriteria = rawCriteria.filter(
    (c) => typeof c.name === 'string' && c.name.trim().length > 0,
  );
  if (validRawCriteria.length === 0) {
    throw new Error(
      'criteria debe contener al menos un criterio evaluado con nombre no vacío.',
    );
  }
  const droppedCount = rawCriteria.length - validRawCriteria.length;

  // Reutiliza las invariantes de ejecución/capacidades/nota ya endurecidas en
  // el parser v2; solo adapta el borde del documento, no su semántica.
  const v2 = parseBuilderEvaluationContractV2(
    JSON.stringify({
      ...object,
      schemaVersion: 'builder-llm/v2',
      gradeBreakdown: validRawCriteria.map((criterion) => ({
        criterion: criterion.name,
        maxPoints: criterion.maxPoints,
        awarded: criterion.awarded,
        justification: criterion.justification,
      })),
      observedEvidence: evidence.map((item) => item.detail),
      evaluationLimits: normalizeStringArray(object.limitations, 'limitations'),
      studentSummary: undefined,
      teacherSummary: undefined,
    }),
  );

  const criteria = v2.gradeBreakdown.map((criterion, index) => {
    const source = validRawCriteria[index];
    const refs = normalizeEvidenceRefs(source.evidenceRefs, evidence, {
      field: `criteria[${index}].evidenceRefs`,
      allowEmpty: false,
    });
    return {
      ...criterion,
      id: stableId('criterion', criterion.criterion, index),
      status: criterionStatus(criterion.awarded, criterion.maxPoints),
      evidenceIds: refs,
    } satisfies BuilderCriterionAssessmentV3;
  });

  const findings = normalizeObjectArray(object.findings, 'findings').map(
    (entry, index) => normalizeFinding(entry, index, evidence, evidenceIds),
  );
  const parsedLimitations = normalizeStringArray(
    object.limitations,
    'limitations',
  );
  const droppedLimits =
    droppedCount > 0
      ? [
          `DISCARDED_CRITERIA: se omitieron ${droppedCount} criterio(s) con nombre vacío.`,
        ]
      : [];
  const mergedLimitations = Array.from(
    new Set([...v2.evaluationLimits, ...parsedLimitations, ...droppedLimits]),
  );
  const parsedReviewFlags = normalizeStringArray(
    object.reviewFlags,
    'reviewFlags',
  );
  const requiresReview =
    droppedCount > 0 ||
    v2.evaluationLimits.some(
      (limit) =>
        limit.includes('INVALID_CONTRACT_REPAIRED') ||
        limit.includes('RESCALED') ||
        limit.includes('GRADE_OUT_OF_RANGE') ||
        limit.includes('TRUNCATED') ||
        limit.includes('RUBRIC_WEIGHTS_ALIGNED'),
    );
  const mergedReviewFlags = Array.from(
    new Set([
      ...parsedReviewFlags,
      ...(requiresReview ? ['REQUIRES_TEACHER_REVIEW'] : []),
    ]),
  );
  const {
    studentSummary: _studentSummary,
    teacherSummary: _teacherSummary,
    ...evaluationBase
  } = v2;

  return {
    ...evaluationBase,
    schemaVersion: BUILDER_EVALUATION_SCHEMA_VERSION,
    gradeBreakdown: criteria,
    criteria,
    evidence,
    findings,
    limitations: mergedLimitations,
    evaluationLimits: mergedLimitations,
    reviewFlags: mergedReviewFlags,
  };
}

function normalizeEvidence(
  entry: JsonObject,
  index: number,
): BuilderEvaluationEvidenceV3 {
  const kind = normalizeString(entry.kind, `evidence[${index}].kind`);
  if (!['execution', 'source', 'rubric'].includes(kind)) {
    throw new Error(`evidence[${index}].kind no está soportado.`);
  }
  const summary = normalizeString(entry.summary, `evidence[${index}].summary`);
  const detail = normalizeString(entry.detail, `evidence[${index}].detail`);
  return {
    id: stableId('evidence', `${summary}\n${detail}`, index),
    kind: kind as BuilderEvaluationEvidenceV3['kind'],
    summary,
    detail,
    // La evidencia redactada por un modelo nunca es pública por defecto. La
    // vista de alumno se construye después con evidencia sintética allowlist.
    visibility: 'teacher',
  };
}

function normalizeFinding(
  entry: JsonObject,
  index: number,
  evidence: BuilderEvaluationEvidenceV3[],
  evidenceIds: Set<string>,
): BuilderEvaluationFindingV3 {
  const severity = normalizeString(
    entry.severity,
    `findings[${index}].severity`,
  ).toLowerCase();
  if (!['low', 'medium', 'high'].includes(severity)) {
    throw new Error(`findings[${index}].severity no es válida.`);
  }
  const title = normalizeString(entry.title, `findings[${index}].title`);
  const refs = normalizeEvidenceRefs(entry.evidenceRefs, evidence, {
    field: `findings[${index}].evidenceRefs`,
    allowEmpty: true,
  });
  if (refs.some((id) => !evidenceIds.has(id))) {
    throw new Error(`findings[${index}] referencia evidencia inexistente.`);
  }
  const file = optionalString(entry.file);
  const line =
    typeof entry.line === 'number' && Number.isInteger(entry.line)
      ? Math.max(1, entry.line)
      : undefined;

  return {
    id: stableId('finding', title, index),
    severity: severity as FindingSeverity,
    title,
    explanation: normalizeString(
      entry.explanation,
      `findings[${index}].explanation`,
    ),
    recommendation: normalizeString(
      entry.recommendation,
      `findings[${index}].recommendation`,
    ),
    blocking: entry.blocking === true,
    evidenceIds: refs,
    ...(file ? { file } : {}),
    ...(line ? { line } : {}),
  };
}

function normalizeEvidenceRefs(
  value: unknown,
  evidence: BuilderEvaluationEvidenceV3[],
  options: { field: string; allowEmpty: boolean },
): string[] {
  if (!Array.isArray(value)) {
    if (options.allowEmpty && (value === undefined || value === null))
      return [];
    throw new Error(`${options.field} debe ser un array de índices.`);
  }
  const ids = value.map((ref, index) => {
    if (
      !Number.isInteger(ref) ||
      (ref as number) < 0 ||
      !evidence[ref as number]
    ) {
      throw new Error(
        `${options.field}[${index}] referencia evidencia inexistente.`,
      );
    }
    return evidence[ref as number].id;
  });
  if (!options.allowEmpty && ids.length === 0) {
    throw new Error(`${options.field} debe citar al menos una evidencia.`);
  }
  return Array.from(new Set(ids));
}

function normalizeObjectArray(value: unknown, field: string): JsonObject[] {
  if (!Array.isArray(value)) throw new Error(`${field} debe ser un array.`);
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${field}[${index}] debe ser un objeto.`);
    }
    return entry as JsonObject;
  });
}

export function criterionStatus(
  awarded: number,
  maxPoints: number,
): BuilderCriterionStatus {
  if (maxPoints <= 0) return 'NOT_ASSESSED';
  if (awarded >= maxPoints - 0.001) return 'ACHIEVED';
  if (awarded <= 0.001) return 'NOT_ACHIEVED';
  return 'PARTIAL';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stableId(prefix: string, value: string, index: number): string {
  let hash = 2166136261;
  const normalized = `${prefix}:${index}:${value.trim().toLowerCase()}`;
  for (let cursor = 0; cursor < normalized.length; cursor += 1) {
    hash ^= normalized.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}
