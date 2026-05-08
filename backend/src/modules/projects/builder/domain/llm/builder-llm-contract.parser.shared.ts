import {
  ASSESSMENTS,
  BUILDER_LLM_SCHEMA_VERSION,
  BUILDER_RUNTIME_FAMILIES,
  BuilderCapabilityMap,
  BuilderLlmStage,
  BuilderRecipeV2,
  BuilderRuntimeDescriptorV2,
  BuilderRuntimeFamily,
  CAPABILITY_IDS,
  CONFIDENCE_LEVELS,
  Confidence,
  EVALUATIVE_STATES,
  EvaluativeState,
} from '../builder.types';
import {
  ALLOWED_C_VERSIONS,
  ALLOWED_NODE_VERSIONS,
  ALLOWED_PYTHON_VERSIONS,
} from '../builder.constants';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';

const ALLOWED_EXECUTABLES = new Set([
  'cmake',
  'coverage',
  'curl',
  'django-admin',
  'flask',
  'g++',
  'gcc',
  'gunicorn',
  'hatch',
  'make',
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
  'valgrind',
  'yarn',
]);

const SHELL_WRAPPER_TOKENS = new Set(['|', '||', '&&', ';', '>', '>>', '<']);

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
    throw new Error(`La salida del ${sourceName} no es JSON válido.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`El ${sourceName} devolvió un JSON no objeto.`);
  }

  return parsed as Record<string, unknown>;
}

export function normalizeSchemaVersion(value: unknown, sourceName: string) {
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
    throw new Error(`stage inválido en ${sourceName}. Se esperaba ${expected}.`);
  }

  return expected;
}

export function normalizeCapabilities(value: unknown): BuilderCapabilityMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('capabilities debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const capabilities = {} as BuilderCapabilityMap;

  for (const capabilityId of CAPABILITY_IDS) {
    const rawCapability = object[capabilityId];
    if (!rawCapability) {
      throw new Error(`Falta capabilities.${capabilityId}.`);
    }

    if (typeof rawCapability === 'string') {
      const status = rawCapability.toLowerCase();
      if (!ASSESSMENTS.includes(status as (typeof ASSESSMENTS)[number])) {
        throw new Error(`Estado inválido en ${capabilityId}: ${rawCapability}.`);
      }
      capabilities[capabilityId] = {
        status: status as BuilderCapabilityMap['C1']['status'],
        rationale: 'Autogenerado: el modelo no proporcionó justificación detallada.',
      };
      continue;
    }

    if (typeof rawCapability !== 'object' || Array.isArray(rawCapability)) {
      throw new Error(`capabilities.${capabilityId} debe ser un objeto.`);
    }

    const capability = rawCapability as Record<string, unknown>;
    const status = normalizeString(
      capability.status,
      `capabilities.${capabilityId}.status`,
    ).toLowerCase();

    if (!ASSESSMENTS.includes(status as (typeof ASSESSMENTS)[number])) {
      throw new Error(`Estado inválido en ${capabilityId}: ${status}.`);
    }

    capabilities[capabilityId] = {
      status: status as BuilderCapabilityMap['C1']['status'],
      rationale: normalizeOptionalString(
        capability.rationale,
        `capabilities.${capabilityId}.rationale`,
        'Sin justificación detallada.',
      ),
    };
  }

  return capabilities;
}

export function normalizeEvaluativeState(
  value: unknown,
  sourceName: string,
): EvaluativeState {
  const state = normalizeString(value, 'evaluativeState').toUpperCase();
  if (!EVALUATIVE_STATES.includes(state as (typeof EVALUATIVE_STATES)[number])) {
    throw new Error(`evaluativeState inválido en ${sourceName}.`);
  }

  return state as EvaluativeState;
}

export function normalizeConfidence(
  value: unknown,
  sourceName: string,
): Confidence {
  const confidence = normalizeString(value, 'confidence').toLowerCase();
  if (!CONFIDENCE_LEVELS.includes(confidence as (typeof CONFIDENCE_LEVELS)[number])) {
    throw new Error(`confidence inválido en ${sourceName}.`);
  }

  return confidence as Confidence;
}

export function normalizeRuntimeDescriptor(
  value: unknown,
  sourceName: string,
): BuilderRuntimeDescriptorV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('runtime debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const family = normalizeRuntimeFamily(object.family, sourceName);
  const version = normalizeRuntimeVersion(family, object.version, sourceName);
  const supported = family === 'python' || family === 'c';
  const reason = supported
    ? null
    : `Solo python y c son ejecutables en esta iteración. Runtime declarado: ${family}.`;

  return {
    family,
    version,
    supported,
    reason,
  };
}

export function normalizeRecipe(
  value: unknown,
  sourceName: string,
): BuilderRecipeV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('recipe debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const run =
    object.run === null || object.run === undefined
      ? null
      : normalizeCommand(object.run, 'recipe.run');

  return {
    install: normalizeCommandMatrix(object.install, 'recipe.install'),
    run,
    test: normalizeCommandMatrix(object.test, 'recipe.test'),
    systemPackages: normalizeSystemPackages(object.systemPackages),
    cwd: normalizeWorkingDirectory(object.cwd),
    environment: normalizeEnvironment(object.environment),
    service: normalizeService(object.service, sourceName),
  };
}

export function normalizeGrade(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;

  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error('recommendedGrade debe ser numérico.');
  }

  const clamped = Math.max(0, Math.min(10, parsed));
  return Math.round(clamped * 100) / 100;
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

export function assertPlanSemanticConsistency(
  capabilities: BuilderCapabilityMap,
  recipe: BuilderRecipeV2,
): void {
  if (capabilities.C3.status === 'yes' && recipe.run === null) {
    throw new Error('C3=yes requiere recipe.run.');
  }

  if (capabilities.C3.status === 'yes' && recipe.service === null) {
    throw new Error('C3=yes requiere recipe.service.');
  }

  if (capabilities.C5.status === 'yes' && recipe.service?.healthcheck === null) {
    throw new Error('C5=yes requiere recipe.service.healthcheck.');
  }

  if (recipe.service !== null && capabilities.C3.status === 'no') {
    throw new Error('recipe.service no puede coexistir con C3=no.');
  }

  if (recipe.run === null && capabilities.C2.status === 'yes') {
    throw new Error('C2=yes requiere recipe.run.');
  }
}

export function assertEvaluationSemanticConsistency(
  capabilities: BuilderCapabilityMap,
  recipe: BuilderRecipeV2,
  observedEvidence: string[],
): void {
  if (observedEvidence.length < 3) {
    throw new Error(
      'observedEvidence debe incluir al menos 3 evidencias concretas.',
    );
  }

  if (capabilities.C3.status === 'yes' && recipe.service === null) {
    throw new Error('C3=yes requiere recipe.service.');
  }

  if (capabilities.C5.status === 'yes' && recipe.service?.healthcheck === null) {
    throw new Error('C5=yes requiere recipe.service.healthcheck.');
  }
}

export function alignCapabilitiesWithRecipe(
  capabilities: BuilderCapabilityMap,
  recipe: BuilderRecipeV2,
): BuilderCapabilityMap {
  const aligned: BuilderCapabilityMap = {
    C1: { ...capabilities.C1 },
    C2: { ...capabilities.C2 },
    C3: { ...capabilities.C3 },
    C4: { ...capabilities.C4 },
    C5: { ...capabilities.C5 },
    C6: { ...capabilities.C6 },
  };

  const expectedC3Status: BuilderCapabilityMap['C3']['status'] =
    recipe.service === null ? 'no' : 'yes';
  if (aligned.C3.status !== expectedC3Status) {
    aligned.C3 = {
      status: expectedC3Status,
      rationale:
        expectedC3Status === 'yes'
          ? 'Autocorregido desde la receta: existe un servicio ejecutable.'
          : 'Autocorregido desde la receta: no existe un servicio ejecutable.',
    };
  }

  const expectedC5Status: BuilderCapabilityMap['C5']['status'] =
    recipe.service?.healthcheck === null || recipe.service?.healthcheck === undefined
      ? 'no'
      : 'yes';
  if (aligned.C5.status !== expectedC5Status) {
    aligned.C5 = {
      status: expectedC5Status,
      rationale:
        expectedC5Status === 'yes'
          ? 'Autocorregido desde la receta: existe un healthcheck ejecutable.'
          : 'Autocorregido desde la receta: no existe un healthcheck ejecutable.',
    };
  }

  return aligned;
}

function normalizeRuntimeFamily(
  value: unknown,
  sourceName: string,
): BuilderRuntimeFamily {
  const family = normalizeString(value, 'runtime.family').toLowerCase();
  if (
    !BUILDER_RUNTIME_FAMILIES.includes(
      family as (typeof BUILDER_RUNTIME_FAMILIES)[number],
    )
  ) {
    throw new Error(`runtime.family inválido en ${sourceName}.`);
  }

  return family as BuilderRuntimeFamily;
}

function normalizeRuntimeVersion(
  family: BuilderRuntimeFamily,
  value: unknown,
  sourceName: string,
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const version = normalizeString(value, 'runtime.version');
  if (family === 'python') {
    if (!ALLOWED_PYTHON_VERSIONS.includes(version as (typeof ALLOWED_PYTHON_VERSIONS)[number])) {
      throw new Error(`runtime.version inválido en ${sourceName}.`);
    }
    return version;
  }

  if (family === 'node') {
    if (!ALLOWED_NODE_VERSIONS.includes(version as (typeof ALLOWED_NODE_VERSIONS)[number])) {
      throw new Error(`runtime.version inválido en ${sourceName}.`);
    }
    return version;
  }

  if (family === 'c') {
    if (!ALLOWED_C_VERSIONS.includes(version as (typeof ALLOWED_C_VERSIONS)[number])) {
      throw new Error(`runtime.version inválido en ${sourceName}.`);
    }
    return version;
  }

  return version;
}

function normalizeService(
  value: unknown,
  sourceName: string,
): BuilderRecipeV2['service'] {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('recipe.service debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const rawPort = object.port;
  const rawHealthcheck = object.healthcheck;

  const hasPort = rawPort !== undefined && rawPort !== null && rawPort !== '';
  const hasHealthcheck =
    rawHealthcheck !== undefined &&
    rawHealthcheck !== null &&
    (!Array.isArray(rawHealthcheck) || rawHealthcheck.length > 0);

  if (!hasPort && !hasHealthcheck) {
    return null;
  }

  return {
    port: normalizePort(rawPort, 'recipe.service.port', sourceName),
    healthcheck: !hasHealthcheck
      ? null
      : normalizeCommand(rawHealthcheck, 'recipe.service.healthcheck'),
  };
}

function normalizeCommandMatrix(value: unknown, field: string): string[][] {
  if (value === undefined || value === null) {
    return [];
  }

  if (typeof value === 'string') {
    return [normalizeCommand(value, field)];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser un array.`);
  }

  if (value.length === 0) {
    return [];
  }

  if (value.every((entry) => !Array.isArray(entry))) {
    return [normalizeCommand(value, field)];
  }

  return value.map((command, index) =>
    normalizeCommand(command, `${field}[${index}]`),
  );
}

function normalizeCommand(value: unknown, field: string): string[] {
  let rawTokens: string[] = [];

  if (typeof value === 'string') {
    rawTokens = value.trim().split(/\s+/u);
  } else if (Array.isArray(value)) {
    rawTokens = value
      .map((entry) =>
        typeof entry === 'string' ? entry.trim() : String(entry ?? '').trim(),
      )
      .filter(Boolean);
  } else {
    throw new Error(`${field} debe ser un array o un string de comando.`);
  }

  const tokens = rawTokens.flatMap((token) => token.split(/\s+/u)).filter(Boolean);
  if (!tokens.length) {
    throw new Error(`${field} no puede estar vacío.`);
  }

  const executable = tokens[0];
  const executablePath = toPosixPath(executable);
  const isRelativeLocalExecutable = executablePath.startsWith('./');
  const isSafeContainerExecutable =
    executablePath.startsWith('/app/') && !isUnsafeRelativePath(executablePath);

  if (
    !ALLOWED_EXECUTABLES.has(executable) &&
    !isRelativeLocalExecutable &&
    !isSafeContainerExecutable
  ) {
    throw new Error(`Executable no permitido en ${field}: ${executable}`);
  }

  if (
    (isRelativeLocalExecutable || isSafeContainerExecutable) &&
    isUnsafeRelativePath(executablePath)
  ) {
    throw new Error(`Ruta insegura en ${field}: ${executable}`);
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
      (token.includes('/') || /\.(py|c|h|o)$/u.test(token)) &&
      (toPosixPath(token).startsWith('/') || toPosixPath(token).includes('../'))
    ) {
      const posix = toPosixPath(token);
      const isSafeContainerPath = posix === '/app' || posix.startsWith('/app/');
      if (!isSafeContainerPath) {
        throw new Error(`Ruta insegura en ${field}: ${token}`);
      }
    }
  }

  return tokens;
}

function isUnsafeRelativePath(value: string): boolean {
  return value.includes('../') || value.includes('/..');
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

function normalizeWorkingDirectory(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const raw = normalizeString(value, 'recipe.cwd');
  const normalized = toPosixPath(raw);
  if (normalized === '/app' || normalized.startsWith('/app/')) {
    if (normalized.includes('../')) {
      throw new Error(`recipe.cwd contiene una ruta insegura: ${raw}`);
    }
    return normalized;
  }

  if (normalized.startsWith('/')) {
    throw new Error(`recipe.cwd debe permanecer dentro de /app: ${raw}`);
  }

  const relative = normalized.replace(/^\.?\//u, '');
  if (!relative || relative.includes('..')) {
    throw new Error(`recipe.cwd contiene una ruta insegura: ${raw}`);
  }

  return `/app/${relative}`;
}

function normalizeEnvironment(
  value: unknown,
): Record<string, string> | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('recipe.environment debe ser un objeto.');
  }

  const object = value as Record<string, unknown>;
  const entries = Object.entries(object);
  if (!entries.length) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, entryValue] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      throw new Error(`Variable de entorno inválida: ${key}`);
    }

    const parsedValue = normalizeString(entryValue, `recipe.environment.${key}`);
    if (/[\n\r]/u.test(parsedValue)) {
      throw new Error(`Valor inseguro en recipe.environment.${key}.`);
    }

    normalized[key] = parsedValue;
  }

  return normalized;
}

function normalizePort(
  value: unknown,
  field: string,
  sourceName: string,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseInt(normalizeString(value, field), 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${field} inválido en ${sourceName}.`);
  }

  return parsed;
}

function normalizeObservedEvidenceEntry(
  value: unknown,
  field: string,
): string {
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

  throw new Error(`${field} debe ser un string no vacÃ­o.`);
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
