/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-facts-contract.parser).
 *
 * @module builder-facts-contract.parser
 */

import { BuilderFactsContractV2 } from '../builder.types';
import {
  normalizeOptionalString,
  normalizeSchemaVersion,
  normalizeStringArray,
  parseRawContract,
} from './parsers/contract-parser.utils';

export function parseBuilderFactsContractV2(
  raw: string,
): BuilderFactsContractV2 {
  const sourceName = 'facts extractor LLM';
  const object = parseRawContract(raw, sourceName);

  const compilationStatus = normalizeCompilationStatus(
    object.compilationStatus,
    sourceName,
  );

  const contract: BuilderFactsContractV2 = {
    schemaVersion: normalizeSchemaVersion(object.schemaVersion, sourceName),
    stage: 'facts',
    thought: normalizeOptionalString(
      object.thought,
      'thought',
      'Sin razonamiento previo documentado.',
    ),
    observedStdout: normalizeStringArray(
      object.observedStdout,
      'observedStdout',
    ),
    observedStderr: normalizeStringArray(
      object.observedStderr,
      'observedStderr',
    ),
    exitCode: normalizeExitCode(object.exitCode),
    compilationStatus,
    matchesOracle: normalizeMatchesOracle(object.matchesOracle, sourceName),
    discrepancies: normalizeStringArray(object.discrepancies, 'discrepancies'),
    filesPresent: normalizeStringArray(object.filesPresent, 'filesPresent'),
    executionSummary: normalizeOptionalString(
      object.executionSummary,
      'executionSummary',
      '',
    ),
    evidenceLimits: normalizeStringArray(
      object.evidenceLimits,
      'evidenceLimits',
    ),
  };

  return contract;
}

function normalizeCompilationStatus(
  value: unknown,
  sourceName: string,
): BuilderFactsContractV2['compilationStatus'] {
  if (value === undefined || value === null) {
    return 'not_applicable';
  }

  const raw = String(value).toLowerCase();
  if (raw === 'success') return 'success';
  if (raw === 'failure') return 'failure';
  if (raw === 'not_applicable' || raw === 'not applicable') {
    return 'not_applicable';
  }

  throw new Error(
    `compilationStatus debe ser 'success', 'failure' o 'not_applicable' en ${sourceName}.`,
  );
}

/**
 * AIP-007: `Boolean(value)` convertía cualquier string no vacío —incluida la
 * cadena literal `"false"`— en `true`, invirtiendo silenciosamente el hecho
 * que esta fase declara como "verdad primaria". Solo se acepta un boolean
 * real o el literal string `"true"`/`"false"` (insensible a mayúsculas);
 * cualquier otro valor es un contrato inválido, no un default.
 */
function normalizeMatchesOracle(value: unknown, sourceName: string): boolean {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  throw new Error(
    `matchesOracle debe ser boolean ('true'/'false') en ${sourceName}.`,
  );
}

function normalizeExitCode(value: unknown): number | null {
  if (value === undefined || value === null) return null;

  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}
