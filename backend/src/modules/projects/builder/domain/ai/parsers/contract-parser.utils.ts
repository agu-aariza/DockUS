/**
 * @fileoverview Motor Builder de evaluación asíncrona (contract-parser.utils).
 *
 * @module contract-parser.utils
 */

import {
  BUILDER_LLM_SCHEMA_VERSION,
  EVALUATIVE_STATES,
  CONFIDENCE_LEVELS,
} from '../../builder.types';
import type {
  EvaluativeState,
  Confidence,
  BuilderLlmStage,
} from '../../builder.types';

export function parseRawContract(
  raw: string,
  sourceName: string,
): Record<string, unknown> {
  const normalized = stripCodeFence(raw).trim();
  if (!normalized) {
    throw new Error(`Salida vacía del ${sourceName}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    const withoutComments = stripJsonComments(normalized);
    try {
      parsed = JSON.parse(withoutComments);
    } catch {
      const repaired = tryRepairJson(withoutComments);
      if (repaired !== null) {
        parsed = repaired;
      } else {
        throw new Error(`La salida del ${sourceName} no es JSON válido.`);
      }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`El ${sourceName} devolvió un JSON no objeto.`);
  }

  return parsed as Record<string, unknown>;
}

export function normalizeSchemaVersion(value: unknown, sourceName: string) {
  if (value === undefined || value === null || value === '') {
    return BUILDER_LLM_SCHEMA_VERSION;
  }

  const normalized = normalizeString(value, 'schemaVersion');
  if (normalized !== BUILDER_LLM_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion inválido en ${sourceName}. Se esperaba ${BUILDER_LLM_SCHEMA_VERSION}.`,
    );
  }

  return BUILDER_LLM_SCHEMA_VERSION;
}

export function normalizeStage<TStage extends BuilderLlmStage>(
  value: unknown,
  expected: TStage,
  sourceName: string,
): TStage {
  const stage = normalizeString(value, 'stage').toLowerCase();
  if (stage !== expected) {
    throw new Error(
      `stage inválido en ${sourceName}. Se esperaba ${expected}.`,
    );
  }

  return expected;
}

export function normalizeEvaluativeState(
  value: unknown,
  sourceName: string,
): EvaluativeState {
  const state = normalizeString(value, 'evaluativeState').toUpperCase();
  if (!EVALUATIVE_STATES.includes(state as any)) {
    throw new Error(`evaluativeState inválido en ${sourceName}.`);
  }

  return state as EvaluativeState;
}

export function normalizeConfidence(
  value: unknown,
  sourceName: string,
): Confidence {
  const confidence = normalizeString(value, 'confidence').toLowerCase();
  if (!CONFIDENCE_LEVELS.includes(confidence as any)) {
    throw new Error(`confidence inválido en ${sourceName}.`);
  }

  return confidence as Confidence;
}

export function normalizeStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser un array.`);
  }

  return value.map((entry, index) =>
    normalizeString(entry, `${field}[${index}]`),
  );
}

export function normalizeObservedEvidence(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('observedEvidence debe ser un array.');
  }

  return value.map((entry, index) =>
    normalizeObservedEvidenceEntry(entry, `observedEvidence[${index}]`),
  );
}

export function normalizeOptionalString(
  value: unknown,
  field: string,
  defaultValue: string,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue;
  }

  return value.trim();
}

export function normalizeString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un string no vacío.`);
  }

  return value.trim();
}

function normalizeObservedEvidenceEntry(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    const file =
      typeof object.file === 'string' && object.file.trim()
        ? object.file.trim()
        : null;
    const content =
      typeof object.content === 'string' && object.content.trim()
        ? object.content.trim()
        : typeof object.evidence === 'string' && object.evidence.trim()
          ? object.evidence.trim()
          : typeof object.summary === 'string' && object.summary.trim()
            ? object.summary.trim()
            : null;

    if (file && content) {
      return `${file}: ${content}`;
    }

    if (content) {
      return content;
    }

    if (file) {
      return file;
    }
  }

  throw new Error(`${field} debe ser un string no vacío.`);
}

function stripJsonComments(text: string): string {
  return text.replace(
    /("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g,
    (match, stringLiteral: string | undefined) => (stringLiteral ? match : ''),
  );
}

function tryRepairJson(raw: string): unknown | null {
  let attempt = raw;

  const opens = (attempt.match(/\{/g) || []).length;
  const closes = (attempt.match(/\}/g) || []).length;
  if (opens > closes) {
    attempt = attempt + '}'.repeat(opens - closes);
  }

  const openBrackets = (attempt.match(/\[/g) || []).length;
  const closeBrackets = (attempt.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    attempt = attempt + ']'.repeat(openBrackets - closeBrackets);
  }

  try {
    return JSON.parse(attempt);
  } catch {
    const escaped = attempt.replace(
      /"([^"]*?)"/g,
      (_match, content: string) => {
        return `"${content}"`;
      },
    );

    const lines = attempt.split('\n');
    const fixedLines = lines.map((line) => {
      const kvMatch = line.match(/^(\s*"[^"]+"\s*:\s*)"(.*)("(?:,?\s*)?)$/);
      if (!kvMatch) return line;

      const prefix = kvMatch[1];
      let value = kvMatch[2];
      const suffix = kvMatch[3];

      value = value.replace(/(?<!\\)"/g, '\\"');
      return `${prefix}"${value}${suffix}`;
    });

    try {
      return JSON.parse(fixedLines.join('\n'));
    } catch {
      try {
        return JSON.parse(escaped);
      } catch {
        return null;
      }
    }
  }
}

function stripCodeFence(value: string): string {
  let content = value;
  const match = value.match(/```[a-zA-Z]*\s*([\s\S]*?)```/u);
  if (match?.[1]) {
    content = match[1].trim();
  } else {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      content = value.slice(start, end + 1).trim();
    }
  }

  return content
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}
