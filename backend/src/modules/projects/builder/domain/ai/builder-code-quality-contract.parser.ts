import { BuilderCodeQualityContractV2 } from '../builder.types';
import {
  parseRawContract,
  normalizeString,
} from './parsers/contract-parser.utils';

const FINDING_SEVERITIES = ['low', 'medium', 'high'] as const;
type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export function parseBuilderCodeQualityContractV2(
  raw: string,
): BuilderCodeQualityContractV2 {
  let parsed: Record<string, unknown>;

  try {
    parsed = parseRawContract(raw, 'quality LLM');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Fallo al parsear CodeQualityContract: ${message}`, {
      cause: error,
    });
  }

  try {
    return {
      thought: normalizeThought(parsed.thought),
      security: normalizeFindingArray('security', parsed.security),
      architecture: normalizeFindingArray('architecture', parsed.architecture),
      quality: normalizeFindingArray('quality', parsed.quality),
      rubricCompliance: normalizeFindingArray(
        'rubricCompliance',
        parsed.rubricCompliance,
      ),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Fallo al parsear CodeQualityContract: ${message}`, {
      cause: error,
    });
  }
}

function normalizeThought(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('thought debe ser un string no vacío.');
  }

  return value.trim();
}

function normalizeFindingArray(
  field: 'security' | 'architecture' | 'quality' | 'rubricCompliance',
  value: unknown,
) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser un array.`);
  }

  return value.flatMap((entry, index) => {
    try {
      return [normalizeFinding(field, entry, index)];
    } catch {
      return [];
    }
  });
}

function normalizeFinding(
  field: 'security' | 'architecture' | 'quality' | 'rubricCompliance',
  value: unknown,
  index: number,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field}[${index}] debe ser un objeto.`);
  }

  const candidate = value as Record<string, unknown>;
  const title = normalizeString(candidate.title, `${field}[${index}].title`);
  const detail = normalizeFindingDetail(candidate, field, index);
  const severity = normalizeSeverity(candidate.severity, field, index);
  const file = normalizeOptionalString(
    candidate.file,
    `${field}[${index}].file`,
  );
  const line = normalizeOptionalPositiveInteger(
    candidate.line,
    `${field}[${index}].line`,
  );
  const codeSnippet = normalizeStringWithDefault(candidate.codeSnippet, '');
  const level = normalizeLevel(candidate.level);
  const conceptExplanation = normalizeStringWithDefault(
    candidate.conceptExplanation,
    '',
  );

  return {
    title,
    detail,
    severity,
    ...(file ? { file } : {}),
    ...(line !== undefined ? { line } : {}),
    codeSnippet,
    level,
    conceptExplanation,
  };
}

function normalizeFindingDetail(
  candidate: Record<string, unknown>,
  field: string,
  index: number,
): string {
  const explicitDetail = normalizeOptionalString(
    candidate.detail,
    `${field}[${index}].detail`,
  );
  if (explicitDetail) {
    return explicitDetail;
  }

  const observation = readOptionalTrimmedString(
    candidate.observacion ?? candidate['observación'] ?? candidate.observation,
  );
  const impact = readOptionalTrimmedString(
    candidate.impacto ?? candidate.impact,
  );
  const recommendation = readOptionalTrimmedString(
    candidate.recomendacion ??
      candidate['recomendación'] ??
      candidate.recommendation,
  );

  const sections = [
    observation ? `Observación: ${observation}` : null,
    impact ? `Impacto: ${impact}` : null,
    recommendation ? `Recomendación: ${recommendation}` : null,
  ].filter((section): section is string => Boolean(section));

  if (sections.length === 0) {
    throw new Error(`${field}[${index}].detail debe ser un string no vacío.`);
  }

  return sections.join(' ');
}

function normalizeOptionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} debe ser un string no vacío.`);
  }

  return value.trim();
}

function normalizeSeverity(
  value: unknown,
  field: string,
  index: number,
): FindingSeverity {
  void field;
  void index;

  if (
    typeof value === 'string' &&
    FINDING_SEVERITIES.includes(value as FindingSeverity)
  ) {
    return value as FindingSeverity;
  }

  return 'medium';
}

function normalizeOptionalPositiveInteger(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} debe ser un entero positivo.`);
  }

  return Number(value);
}

function readOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

const VALID_LEVELS = ['basico', 'intermedio', 'avanzado'] as const;
type FindingLevel = (typeof VALID_LEVELS)[number];

function normalizeStringWithDefault(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function normalizeLevel(value: unknown): FindingLevel {
  if (
    typeof value === 'string' &&
    VALID_LEVELS.includes(value as FindingLevel)
  ) {
    return value as FindingLevel;
  }
  return 'basico';
}
