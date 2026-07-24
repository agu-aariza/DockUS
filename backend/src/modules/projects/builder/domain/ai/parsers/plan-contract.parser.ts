/**
 * @fileoverview Motor Builder de evaluación asíncrona (plan-contract.parser).
 *
 * @module plan-contract.parser
 */

const BUILD_SYSTEM_EXECUTABLES = new Set(['make', 'cmake', 'gcc', 'g++', 'cc']);
import 'reflect-metadata';
import {
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  IsObject,
  validateSync,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

import { ASSESSMENTS, CAPABILITY_IDS } from '../../builder.types';
import type {
  BuilderCapabilityMap,
  BuilderRecipeV2,
  BuilderRuntimeDescriptorV2,
  BuilderRuntimeFamily,
} from '../../builder.types';
import {
  BUILDER_RUNTIME_FAMILIES,
  isSupportedRuntimeFamily,
  normalizeRuntimeVersion,
  RUNTIME_CATALOG,
} from '../../runtime-catalog';
import { toPosixPath } from '../../../infrastructure/utils/builder-analysis.util';

import { normalizeString } from './contract-parser.utils';

class CapabilityDto {
  @IsEnum(['yes', 'no', 'unknown'])
  status: 'yes' | 'no' | 'unknown';

  @IsString()
  @IsOptional()
  rationale?: string;
}

class CapabilitiesDto {
  @ValidateNested()
  @Type(() => CapabilityDto)
  C1: CapabilityDto;

  @ValidateNested()
  @Type(() => CapabilityDto)
  C2: CapabilityDto;

  @ValidateNested()
  @Type(() => CapabilityDto)
  C3: CapabilityDto;

  @ValidateNested()
  @Type(() => CapabilityDto)
  C4: CapabilityDto;

  @ValidateNested()
  @Type(() => CapabilityDto)
  C5: CapabilityDto;

  @ValidateNested()
  @Type(() => CapabilityDto)
  C6: CapabilityDto;
}

class RuntimeDto {
  @IsEnum(BUILDER_RUNTIME_FAMILIES)
  family: BuilderRuntimeFamily;

  @IsString()
  @IsOptional()
  version?: string | null;

  @IsBoolean()
  @IsOptional()
  supported?: boolean;

  @IsString()
  @IsOptional()
  reason?: string | null;
}

class ServiceDto {
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  healthcheck?: string[] | null;
}

class RecipeDto {
  @IsArray()
  @IsArray({ each: true })
  @IsOptional()
  install?: string[][];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  run?: string[] | null;

  @IsArray()
  @IsArray({ each: true })
  @IsOptional()
  test?: string[][];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  systemPackages?: string[];

  @IsString()
  @IsOptional()
  cwd?: string | null;

  @IsObject()
  @IsOptional()
  environment?: Record<string, string> | null;

  @ValidateNested()
  @Type(() => ServiceDto)
  @IsOptional()
  service?: ServiceDto | null;
}

// --- Constants & Utilities ---

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

const SERVICE_EXECUTABLE_DEFAULTS: Record<string, number> = {
  uvicorn: 8000,
  gunicorn: 8000,
};

// Cualquiera de estos caracteres, en cualquier posición del token (no solo
// como token aislado), permite a un shell reinterpretar el resto de la
// cadena como un comando distinto cuando dependencyInstallCmd/buildCmd se
// incrustan sin escapar en `RUN <cmd>` (Dockerfile).
const SHELL_METACHARACTER_PATTERN = /[;&|`$<>(){}\n\r'"]/u;

export function normalizeCapabilities(value: unknown): BuilderCapabilityMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('capabilities debe ser un objeto.');
  }

  // Pre-process raw capabilities if strings are provided instead of objects
  const target = { ...value } as any;
  for (const capabilityId of CAPABILITY_IDS) {
    const rawVal = target[capabilityId];
    if (rawVal === undefined) {
      throw new Error(`Falta capabilities.${capabilityId}.`);
    }
    if (typeof rawVal === 'string') {
      const status = rawVal.toLowerCase();
      if (!ASSESSMENTS.includes(status as any)) {
        throw new Error(`Estado inválido en ${capabilityId}: ${rawVal}.`);
      }
      target[capabilityId] = {
        status,
        rationale:
          'Autogenerado: el modelo no proporcionó justificación detallada.',
      };
    } else if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal)) {
      if (rawVal.status === undefined) {
        throw new Error(
          `capabilities.${capabilityId}.status debe ser un string no vacío.`,
        );
      }
      const status = String(rawVal.status).toLowerCase();
      if (!ASSESSMENTS.includes(status as any)) {
        throw new Error(
          `Estado inválido en ${capabilityId}: ${rawVal.status}.`,
        );
      }
      target[capabilityId] = {
        status,
        rationale:
          rawVal.rationale !== undefined && String(rawVal.rationale).trim()
            ? String(rawVal.rationale).trim()
            : 'Sin justificación detallada.',
      };
    } else {
      throw new Error(`capabilities.${capabilityId} debe ser un objeto.`);
    }
  }

  const dto = plainToInstance(CapabilitiesDto, target);
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw new Error('capabilities debe ser un objeto.');
  }

  return dto as BuilderCapabilityMap;
}

export function normalizeRuntimeDescriptor(
  value: unknown,
  sourceName: string,
): BuilderRuntimeDescriptorV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('runtime debe ser un objeto.');
  }

  const dto = plainToInstance(RuntimeDto, value);
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw new Error(`runtime.family inválido en ${sourceName}.`);
  }

  const family = dto.family;
  let version = dto.version ? String(dto.version).trim() : null;

  // ARQ-010: la normalización de versión (incluidos los alias de C, p.ej.
  // gcc-13 -> c17) vive en el catálogo, no como un if/else por familia aquí.
  if (version !== null) {
    version = normalizeRuntimeVersion(family, version);
  }

  const supported =
    isSupportedRuntimeFamily(family) && RUNTIME_CATALOG[family].executable;
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

  const raw = value as any;
  const run =
    raw.run === null || raw.run === undefined
      ? null
      : coerceRunToSingleCommand(raw.run);

  const dto = plainToInstance(RecipeDto, {
    ...raw,
    run,
    install: normalizeCommandMatrix(raw.install, 'recipe.install'),
    test: normalizeCommandMatrix(raw.test, 'recipe.test'),
    systemPackages: normalizeSystemPackages(raw.systemPackages),
    cwd: normalizeWorkingDirectory(raw.cwd),
    environment: normalizeEnvironment(raw.environment),
    service: inferServiceFromRun(
      run,
      normalizeService(raw.service, sourceName),
    ),
  });

  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw new Error('recipe debe ser un objeto.');
  }

  return dto as BuilderRecipeV2;
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

  if (
    capabilities.C5.status === 'yes' &&
    recipe.service?.healthcheck === null
  ) {
    throw new Error('C5=yes requiere recipe.service.healthcheck.');
  }

  if (recipe.service !== null && capabilities.C3.status === 'no') {
    throw new Error('recipe.service no puede coexistir con C3=no.');
  }

  if (recipe.run === null && capabilities.C2.status === 'yes') {
    throw new Error('C2=yes requiere recipe.run.');
  }
}

export function detectBuildSystemInRun(recipe: BuilderRecipeV2): string | null {
  if (!recipe.run || recipe.run.length === 0) return null;
  const runExecutable = recipe.run[0];
  if (BUILD_SYSTEM_EXECUTABLES.has(runExecutable)) {
    return `recipe.run[0] es '${runExecutable}', que es un compilador/build-system, no un ejecutable de programa.`;
  }
  return null;
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
    recipe.service?.healthcheck === null ||
    recipe.service?.healthcheck === undefined
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

  const resolvedPort = hasPort
    ? normalizePort(rawPort, 'recipe.service.port', sourceName)
    : 8000;

  let healthcheckValue = rawHealthcheck;
  if (
    hasHealthcheck &&
    typeof rawHealthcheck === 'object' &&
    !Array.isArray(rawHealthcheck)
  ) {
    const hcObj = rawHealthcheck as Record<string, unknown>;

    if (hcObj.command !== undefined && hcObj.command !== null) {
      healthcheckValue = hcObj.command;
    } else {
      const path = typeof hcObj.path === 'string' ? hcObj.path : '/';
      healthcheckValue = [
        'curl',
        '-f',
        `http://localhost:${resolvedPort}${path}`,
      ];
    }
  }

  return {
    port: resolvedPort,
    healthcheck: !hasHealthcheck
      ? null
      : normalizeCommand(healthcheckValue, 'recipe.service.healthcheck'),
  };
}

function inferServiceFromRun(
  run: string[] | null,
  existingService: BuilderRecipeV2['service'],
): BuilderRecipeV2['service'] {
  if (existingService !== null) return existingService;
  if (!run || run.length === 0) return null;

  const executable = run[0];
  let defaultPort = SERVICE_EXECUTABLE_DEFAULTS[executable];

  if (executable === 'flask' && run[1] === 'run') {
    defaultPort = 5000;
  }

  if (defaultPort === undefined) return null;

  const portIdx = run.indexOf('--port');
  const port =
    portIdx !== -1 && run[portIdx + 1]
      ? parseInt(run[portIdx + 1], 10) || defaultPort
      : defaultPort;

  return {
    port,
    healthcheck: ['curl', '-f', `http://localhost:${port}/`],
  };
}

function coerceRunToSingleCommand(value: unknown): string[] {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => Array.isArray(entry))
  ) {
    const meaningful = value.find(
      (cmd: unknown[]) =>
        Array.isArray(cmd) &&
        cmd.length > 0 &&
        typeof cmd[0] === 'string' &&
        cmd[0] !== 'echo' &&
        cmd[0] !== 'printf',
    );
    return normalizeCommand(meaningful ?? value[0], 'recipe.run');
  }

  return normalizeCommand(value, 'recipe.run');
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
  let rawTokens: string[];

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

  const tokens = rawTokens
    .flatMap((token) => token.split(/\s+/u))
    .filter(Boolean);
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
    if (SHELL_METACHARACTER_PATTERN.test(token)) {
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

function normalizeEnvironment(value: unknown): Record<string, string> | null {
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

    const parsedValue = normalizeString(
      entryValue,
      `recipe.environment.${key}`,
    );
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
