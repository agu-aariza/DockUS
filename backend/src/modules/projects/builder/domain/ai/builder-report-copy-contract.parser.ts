import {
  BUILDER_REPORT_COPY_SCHEMA_VERSION,
  BuilderReportCopyContractV1,
  BuilderStudentNarrativeV1,
  BuilderTeacherNarrativeV1,
} from '../builder.types';
import {
  normalizeString,
  normalizeStringArray,
  parseRawContract,
} from './parsers/contract-parser.utils';

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'stage',
  'studentNarrative',
  'teacherNarrative',
]);
const STUDENT_KEYS = new Set([
  'headline',
  'achievements',
  'gaps',
  'conceptBridges',
  'nextSteps',
]);
const TEACHER_KEYS = new Set([
  'executiveSummary',
  'strengths',
  'concerns',
  'followUp',
  'reviewQuestions',
]);
const FORBIDDEN_SCORE_KEY =
  /(?:score|grade|nota|points?|awarded|status|outcome|confidence)/iu;

/** La etapa reporting solo puede redactar; nunca recalificar. */
export function parseBuilderReportCopyContractV1(
  raw: string,
): BuilderReportCopyContractV1 {
  const object = parseRawContract(raw, 'redactor de informes');
  rejectUnexpectedKeys(object, TOP_LEVEL_KEYS, 'reporting');
  rejectScoreKeys(object, 'reporting');

  if (object.schemaVersion !== BUILDER_REPORT_COPY_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion inválido en reporting. Se esperaba ${BUILDER_REPORT_COPY_SCHEMA_VERSION}.`,
    );
  }
  if (object.stage !== 'reporting') {
    throw new Error('stage inválido en reporting. Se esperaba reporting.');
  }

  const student = normalizeObject(object.studentNarrative, 'studentNarrative');
  const teacher = normalizeObject(object.teacherNarrative, 'teacherNarrative');
  rejectUnexpectedKeys(student, STUDENT_KEYS, 'studentNarrative');
  rejectUnexpectedKeys(teacher, TEACHER_KEYS, 'teacherNarrative');

  return {
    schemaVersion: BUILDER_REPORT_COPY_SCHEMA_VERSION,
    stage: 'reporting',
    studentNarrative: {
      headline: normalizeString(student.headline, 'studentNarrative.headline'),
      achievements: requiredStrings(
        student.achievements,
        'studentNarrative.achievements',
      ),
      gaps: normalizeStringArray(student.gaps, 'studentNarrative.gaps'),
      conceptBridges: normalizeStringArray(
        student.conceptBridges,
        'studentNarrative.conceptBridges',
      ),
      nextSteps: requiredStrings(
        student.nextSteps,
        'studentNarrative.nextSteps',
      ),
    } satisfies BuilderStudentNarrativeV1,
    teacherNarrative: {
      executiveSummary: normalizeString(
        teacher.executiveSummary,
        'teacherNarrative.executiveSummary',
      ),
      strengths: normalizeStringArray(
        teacher.strengths,
        'teacherNarrative.strengths',
      ),
      concerns: normalizeStringArray(
        teacher.concerns,
        'teacherNarrative.concerns',
      ),
      followUp: requiredStrings(teacher.followUp, 'teacherNarrative.followUp'),
      reviewQuestions: normalizeStringArray(
        teacher.reviewQuestions,
        'teacherNarrative.reviewQuestions',
      ),
    } satisfies BuilderTeacherNarrativeV1,
  };
}

function requiredStrings(value: unknown, field: string): string[] {
  const entries = normalizeStringArray(value, field);
  if (entries.length === 0) throw new Error(`${field} no puede estar vacío.`);
  return entries;
}

function normalizeObject(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} debe ser un objeto.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnexpectedKeys(
  object: Record<string, unknown>,
  allowed: Set<string>,
  field: string,
): void {
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${field} contiene campos no permitidos: ${unexpected.join(', ')}.`,
    );
  }
}

function rejectScoreKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectScoreKeys(entry, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SCORE_KEY.test(key)) {
      throw new Error(`${path}.${key} intenta modificar la evaluación.`);
    }
    rejectScoreKeys(entry, `${path}.${key}`);
  }
}
