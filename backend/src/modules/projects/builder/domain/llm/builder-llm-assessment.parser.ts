import {
  ASSESSMENTS,
  BuilderLlmAssessment,
  CAPABILITY_IDS,
  CONFIDENCE_LEVELS,
  EVALUATIVE_STATES,
} from '../builder.types';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';

const ALLOWED_EXECUTABLES = new Set([
  'coverage',
  'flask',
  'gunicorn',
  'hatch',
  'pdm',
  'pip',
  'pip3',
  'pipenv',
  'poetry',
  'pytest',
  'python',
  'python3',
  'streamlit',
  'tox',
  'uv',
  'uvicorn',
]);

const SHELL_WRAPPER_TOKENS = new Set(['|', '||', '&&', ';', '>', '>>', '<']);

interface ParserOptions {
  mode: 'planning' | 'evaluation';
}

export function parseBuilderLlmAssessment(
  raw: string,
  options: ParserOptions,
): BuilderLlmAssessment {
  const sourceName =
    options.mode === 'planning' ? 'planner LLM' : 'evaluador LLM';
  const normalized = stripCodeFence(raw).trim();
  if (!normalized) {
    throw new Error(`Salida vacía del ${sourceName}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(`La salida del ${sourceName} no es JSON válido.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`El ${sourceName} devolvió un JSON no objeto.`);
  }

  const object = parsed as Record<string, unknown>;
  const assessment: BuilderLlmAssessment = {
    structuralType: normalizeStructuralType(
      object.structuralType,
      options.mode,
    ),
    capabilities: normalizeCapabilities(object.capabilities),
    evaluativeState: normalizeEvaluativeState(
      object.evaluativeState,
      options.mode,
    ),
    confidence: normalizeConfidence(object.confidence, options.mode),
    rationale: normalizeString(object.rationale, 'rationale'),
    externalRequirements: normalizeStringArray(
      object.externalRequirements,
      'externalRequirements',
    ),
    recipe: normalizeRecipe(object.recipe, options.mode),
    evidenceSummary: normalizeString(object.evidenceSummary, 'evidenceSummary'),
    observedEvidence: normalizeStringArray(
      object.observedEvidence,
      'observedEvidence',
    ),
    evaluationLimits: normalizeStringArray(
      object.evaluationLimits,
      'evaluationLimits',
    ),
  };

  assertSemanticConsistency(assessment, options.mode);
  return assessment;
}

function normalizeCapabilities(
  value: unknown,
): BuilderLlmAssessment['capabilities'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('capabilities debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const capabilities = {} as BuilderLlmAssessment['capabilities'];

  for (const capabilityId of CAPABILITY_IDS) {
    const rawCapability = object[capabilityId];
    if (
      !rawCapability ||
      typeof rawCapability !== 'object' ||
      Array.isArray(rawCapability)
    ) {
      throw new Error(`capabilities.${capabilityId} debe ser un objeto.`);
    }

    const capability = rawCapability as Record<string, unknown>;
    const status = normalizeString(
      capability.status,
      `capabilities.${capabilityId}.status`,
    );
    if (!ASSESSMENTS.includes(status as (typeof ASSESSMENTS)[number])) {
      throw new Error(`Estado inválido en ${capabilityId}.`);
    }

    capabilities[capabilityId] = {
      status: status as BuilderLlmAssessment['capabilities']['C1']['status'],
      rationale: normalizeString(
        capability.rationale,
        `capabilities.${capabilityId}.rationale`,
      ),
    };
  }

  return capabilities;
}

function normalizeRecipe(
  value: unknown,
  mode: ParserOptions['mode'],
): BuilderLlmAssessment['recipe'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('recipe debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const run =
    object.run === null || object.run === undefined
      ? null
      : normalizeCommand(object.run, 'recipe.run');
  const healthcheck =
    object.healthcheck === null || object.healthcheck === undefined
      ? null
      : normalizeCommand(object.healthcheck, 'recipe.healthcheck');

  return {
    install: normalizeCommandMatrix(object.install, 'recipe.install'),
    run,
    test: normalizeCommandMatrix(object.test, 'recipe.test'),
    healthcheck,
    servicePort:
      object.servicePort === null || object.servicePort === undefined
        ? null
        : normalizePort(object.servicePort, 'recipe.servicePort', mode),
    systemPackages: normalizeSystemPackages(object.systemPackages),
  };
}

function assertSemanticConsistency(
  assessment: BuilderLlmAssessment,
  mode: ParserOptions['mode'],
): void {
  if (
    assessment.capabilities.C3.status === 'yes' &&
    assessment.recipe.run === null
  ) {
    throw new Error('C3=yes requiere recipe.run.');
  }

  if (
    assessment.capabilities.C3.status === 'yes' &&
    assessment.recipe.servicePort === null
  ) {
    throw new Error('C3=yes requiere recipe.servicePort.');
  }

  if (
    assessment.capabilities.C5.status === 'yes' &&
    assessment.recipe.healthcheck === null
  ) {
    throw new Error('C5=yes requiere recipe.healthcheck.');
  }

  if (mode === 'evaluation') {
    return;
  }

  if (
    assessment.capabilities.C5.status === 'yes' &&
    assessment.capabilities.C3.status !== 'yes'
  ) {
    throw new Error('C5=yes requiere C3=yes.');
  }

  if (
    assessment.recipe.run === null &&
    assessment.capabilities.C2.status === 'yes'
  ) {
    throw new Error('C2=yes requiere recipe.run.');
  }

  if (
    assessment.recipe.run !== null &&
    assessment.recipe.servicePort !== null &&
    assessment.capabilities.C3.status === 'no'
  ) {
    throw new Error('servicePort no puede coexistir con C3=no.');
  }
}

function normalizeStructuralType(value: unknown, mode: ParserOptions['mode']) {
  return normalizeString(value, 'structuralType');
}

function normalizeEvaluativeState(value: unknown, mode: ParserOptions['mode']) {
  const normalized = normalizeString(value, 'evaluativeState');
  if (
    !EVALUATIVE_STATES.includes(
      normalized as (typeof EVALUATIVE_STATES)[number],
    )
  ) {
    throw new Error(
      `evaluativeState inválido en ${mode === 'planning' ? 'planner' : 'evaluador'} LLM.`,
    );
  }
  return normalized as BuilderLlmAssessment['evaluativeState'];
}

function normalizeConfidence(value: unknown, mode: ParserOptions['mode']) {
  const normalized = normalizeString(value, 'confidence');
  if (
    !CONFIDENCE_LEVELS.includes(
      normalized as (typeof CONFIDENCE_LEVELS)[number],
    )
  ) {
    throw new Error(
      `confidence inválido en ${mode === 'planning' ? 'planner' : 'evaluador'} LLM.`,
    );
  }
  return normalized as BuilderLlmAssessment['confidence'];
}

function normalizeSystemPackages(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('recipe.systemPackages debe ser un array.');
  }

  return value.map((entry, index) => {
    const pkg = normalizeString(entry, `recipe.systemPackages[${index}]`);
    if (!/^[a-z0-9.+-]+$/i.test(pkg)) {
      throw new Error(`Paquete de sistema inválido: ${pkg}`);
    }
    return pkg;
  });
}

function normalizeCommandMatrix(value: unknown, field: string): string[][] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser un array de comandos.`);
  }

  return value.map((command, index) =>
    normalizeCommand(command, `${field}[${index}]`),
  );
}

function normalizeCommand(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} debe ser un array no vacío.`);
  }

  const tokens = value.map((token, index) =>
    normalizeString(token, `${field}[${index}]`),
  );
  const executable = tokens[0];
  if (!ALLOWED_EXECUTABLES.has(executable)) {
    throw new Error(`Executable no permitido en ${field}: ${executable}`);
  }

  for (const [index, token] of tokens.entries()) {
    if (/[\n\r`]/.test(token)) {
      throw new Error(`Token inseguro en ${field}: ${token}`);
    }
    if (SHELL_WRAPPER_TOKENS.has(token) || /\$\(.+\)/u.test(token)) {
      throw new Error(`Token de shell no permitido en ${field}: ${token}`);
    }
    if (
      index > 0 &&
      (token.includes('/') || token.endsWith('.py')) &&
      (toPosixPath(token).startsWith('/') || toPosixPath(token).includes('../'))
    ) {
      throw new Error(`Ruta insegura en ${field}: ${token}`);
    }
  }

  return tokens;
}

function normalizePort(
  value: unknown,
  field: string,
  mode: ParserOptions['mode'],
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseInt(normalizeString(value, field), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `${field} inválido en ${mode === 'planning' ? 'planner' : 'evaluador'} LLM.`,
    );
  }
  return parsed;
}

function normalizeStringArray(value: unknown, field: string): string[] {
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

function normalizeString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un string no vacío.`);
  }
  return value.trim();
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/u, '')
    .replace(/```$/u, '')
    .trim();
}
