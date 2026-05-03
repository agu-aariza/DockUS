import {
  ASSESSMENTS,
  BuilderLlmAssessment,
  CAPABILITY_IDS,
  CONFIDENCE_LEVELS,
  EVALUATIVE_STATES,
} from '../builder.types';
import { ALLOWED_PYTHON_VERSIONS } from '../builder.constants';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';

const ALLOWED_EXECUTABLES = new Set([
  'coverage',
  'curl',
  'django-admin',
  'flask',
  'gunicorn',
  'hatch',
  'manage.py',
  'node',
  'npm',
  'npx',
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
  'yarn',
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
    thought: normalizeOptionalString(
      object.thought,
      'thought',
      'Sin razonamiento previo documentado.',
    ),
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
    rationale: normalizeOptionalString(
      object.rationale,
      'rationale',
      'Sin justificacion detallada.',
    ),
    externalRequirements: normalizeStringArray(
      object.externalRequirements,
      'externalRequirements',
    ),
    recipe: normalizeRecipe(object.recipe, options.mode),
    evidenceSummary: normalizeOptionalString(
      object.evidenceSummary,
      'evidenceSummary',
      '',
    ),
    observedEvidence: normalizeOptionalStringArray(
      object.observedEvidence,
      'observedEvidence',
    ),
    evaluationLimits: normalizeOptionalStringArray(
      object.evaluationLimits,
      'evaluationLimits',
    ),
    recommendedGrade: normalizeGrade(object.recommendedGrade),
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

    // Resiliencia: Si el LLM manda solo el string de estado, lo convertimos en objeto
    if (typeof rawCapability === 'string') {
      const status = rawCapability.toLowerCase().trim();
      capabilities[capabilityId] = {
        status: (ASSESSMENTS.includes(status as any)
          ? status
          : 'unknown') as any,
        rationale: 'Estado inferido por formato plano del LLM.',
      };
      continue;
    }

    if (
      !rawCapability ||
      (typeof rawCapability !== 'object' && typeof rawCapability !== 'string') ||
      Array.isArray(rawCapability)
    ) {
      capabilities[capabilityId] = {
        status: 'unknown',
        rationale: 'Capacidad no detectada o formato inválido en la salida del LLM.',
      };
      continue;
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
      rationale: normalizeOptionalString(
        capability.rationale,
        `capabilities.${capabilityId}.rationale`,
        'Sin justificación detallada.',
      ),
    };
  }

  // AUTO-CORRECCIÓN LÓGICA: Si hay healthcheck (C5), debe haber servicio (C3)
  if (capabilities.C5.status === 'yes' && capabilities.C3.status !== 'yes') {
    capabilities.C3.status = 'yes';
    capabilities.C3.rationale =
      '[Auto-corregido] Servicio implícito por presencia de healthcheck.';
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
    runtimeVersion: normalizeRuntimeVersion(object.runtimeVersion),
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
    assessment.capabilities.C5.status = 'no';
    assessment.capabilities.C5.rationale =
      '[Auto-corregido] Se degradó C5=no porque el LLM no proporcionó un comando de healthcheck válido.';
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
  const raw = String(value || '').toUpperCase();
  
  // Buscar E1..E4 en el string
  for (const state of EVALUATIVE_STATES) {
    if (raw.includes(state)) {
      return state as BuilderLlmAssessment['evaluativeState'];
    }
  }

  return 'E4'; // Por defecto bloqueado si es ilegible
}

function normalizeConfidence(value: unknown, mode: ParserOptions['mode']) {
  const raw = String(value || '').toLowerCase();
  
  for (const level of CONFIDENCE_LEVELS) {
    if (raw.includes(level)) {
      return level as BuilderLlmAssessment['confidence'];
    }
  }

  return 'low'; // Por defecto baja confianza si es ilegible
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
  
  // Si el LLM manda un solo comando en lugar de un array de comandos
  if (typeof value === 'string') {
    return [normalizeCommand(value, field)];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((command, index) => {
      try {
        return normalizeCommand(command, `${field}[${index}]`);
      } catch {
        return null;
      }
    })
    .filter((c): c is string[] => c !== null && c.length > 0);
}

function normalizeCommand(value: unknown, field: string): string[] {
  let rawTokens: string[] = [];

  if (typeof value === 'string') {
    rawTokens = value.trim().split(/\s+/u);
  } else if (Array.isArray(value)) {
    rawTokens = value
      .map((t) => (typeof t === 'string' ? t.trim() : String(t || '').trim()))
      .filter(Boolean);
  } else {
    throw new Error(`${field} debe ser un array o un string de comando.`);
  }

  // Tokenización profunda: si algún token contiene espacios, lo dividimos.
  // Esto previene que ["uvicorn app.main"] se trate como un solo ejecutable.
  const tokens = rawTokens.flatMap(t => t.split(/\s+/u)).filter(Boolean);

  if (tokens.length === 0) {
    throw new Error(`${field} no puede estar vacío.`);
  }

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
      const posix = toPosixPath(token);
      const isSafeContainerPath = posix.startsWith('/app/') || posix === '/app';
      if (!isSafeContainerPath) {
        throw new Error(`Ruta insegura en ${field}: ${token}`);
      }
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

function normalizeGrade(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  
  if (Number.isNaN(parsed)) return undefined;
  
  // Clamp entre 0 y 10 y redondear a 2 decimales
  const clamped = Math.max(0, Math.min(10, parsed));
  return Math.round(clamped * 100) / 100;
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

function normalizeOptionalStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function normalizeString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un string no vacío.`);
  }
  return value.trim();
}

function normalizeRuntimeVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const version = value.trim();
  if (ALLOWED_PYTHON_VERSIONS.includes(version as any)) {
    return version;
  }
  return null;
}

function normalizeOptionalString(
  value: unknown,
  field: string,
  defaultValue: string,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue;
  }
  return value.trim();
}

function stripCodeFence(value: string): string {
  let content = value;
  const match = value.match(/```[a-zA-Z]*\s*([\s\S]*?)```/u);
  if (match && match[1]) {
    content = match[1].trim();
  } else {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      content = value.substring(start, end + 1).trim();
    }
  }

  // Limpieza agresiva para JSON de LLMs pequeños
  return content
    .replace(/,\s*([\]}])/g, '$1') // Quitar comas colgantes
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Quitar caracteres de control invisibles
    .trim();
}
