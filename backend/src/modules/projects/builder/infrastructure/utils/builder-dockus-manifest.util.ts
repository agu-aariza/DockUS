import { readFile } from 'fs/promises';
import {
  DependencyManager,
  ManifestSource,
  PythonExecutionProfile,
} from '../../domain/builder.types';
import type { RuntimeFile } from '../../domain/builder.types';

const YAML_MODULE = 'js-yaml';

export interface DockusManifest {
  pythonVersion: string | null;
  workingDirectory: string | null;
  dependencyManager: DependencyManager | null;
  install: string[][];
  run: string[] | null;
  test: string[][];
  healthcheck: string[] | null;
  servicePort: number | null;
  systemPackages: string[];
  env: Record<string, string>;
  executionProfile: PythonExecutionProfile | null;
  entrypoint: string | null;
}

export interface LoadedDockusManifest {
  manifest: DockusManifest;
  manifestPath: string;
  manifestSource: ManifestSource;
}

export async function loadDockusManifest(
  runtimeFiles: RuntimeFile[],
): Promise<LoadedDockusManifest | null> {
  const candidates = runtimeFiles
    .filter((file) => /(^|\/)dockus\.ya?ml$/iu.test(file.relativePath))
    .sort((a, b) => {
      const depthA = toPosixPath(a.relativePath).split('/').length;
      const depthB = toPosixPath(b.relativePath).split('/').length;
      if (depthA === depthB) {
        return a.relativePath.localeCompare(b.relativePath);
      }
      return depthA - depthB;
    });

  if (candidates.length === 0) {
    return null;
  }

  const manifestFile = candidates[0];
  const raw = await readFile(manifestFile.absolutePath, 'utf8');
  const yaml = require(YAML_MODULE) as {
    load: (source: string) => unknown;
  };
  const parsed = yaml.load(raw);
  const manifest = normalizeManifest(parsed);

  return {
    manifest,
    manifestPath: toPosixPath(manifestFile.relativePath),
    manifestSource: 'DOCKUS_MANIFEST',
  };
}

function normalizeManifest(raw: unknown): DockusManifest {
  const source = isRecord(raw) ? raw : {};

  return {
    pythonVersion: normalizeOptionalString(source.pythonVersion),
    workingDirectory: normalizeWorkingDirectory(source.workingDirectory),
    dependencyManager: normalizeDependencyManager(source.dependencyManager),
    install: normalizeCommandList(source.install),
    run: normalizeSingleCommand(source.run),
    test: normalizeCommandList(source.test),
    healthcheck: normalizeSingleCommand(source.healthcheck),
    servicePort: normalizeServicePort(source.servicePort),
    systemPackages: normalizeStringArray(source.systemPackages),
    env: normalizeEnv(source.env),
    executionProfile: normalizeExecutionProfile(source.executionProfile),
    entrypoint: normalizeOptionalString(source.entrypoint),
  };
}

function normalizeCommandList(value: unknown): string[][] {
  if (value == null) {
    return [];
  }

  const single = normalizeSingleCommand(value);
  if (single) {
    return [single];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeSingleCommand(entry))
    .filter(
      (entry): entry is string[] => Array.isArray(entry) && entry.length > 0,
    );
}

function normalizeSingleCommand(value: unknown): string[] | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const tokens = value
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter(Boolean);
    return tokens.length > 0 ? tokens : null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const tokens = value
    .map((token) => (typeof token === 'string' ? token.trim() : ''))
    .filter(Boolean);
  return tokens.length > 0 ? tokens : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function normalizeEnv(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey || typeof raw !== 'string') {
      continue;
    }
    output[normalizedKey] = raw;
  }

  return output;
}

function normalizeServicePort(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value > 0 && value < 65536 ? value : null;
  }

  if (typeof value === 'string' && /^\d{2,5}$/u.test(value.trim())) {
    const port = Number(value.trim());
    return port > 0 && port < 65536 ? port : null;
  }

  return null;
}

function normalizeWorkingDirectory(value: unknown): string | null {
  const workingDirectory = normalizeOptionalString(value);
  if (!workingDirectory) {
    return null;
  }

  const normalized = toPosixPath(workingDirectory).replace(/\/+$/u, '');
  if (!normalized || normalized === '.') {
    return '.';
  }

  const segments = normalized.split('/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized)) {
    return null;
  }
  if (segments.includes('..')) {
    return null;
  }

  return normalized;
}

function normalizeDependencyManager(value: unknown): DependencyManager | null {
  const normalized = normalizeOptionalString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  const aliases: Record<string, DependencyManager> = {
    pip: 'pip-requirements',
    'pip-requirements': 'pip-requirements',
    requirements: 'pip-requirements',
    pyproject: 'pyproject',
    poetry: 'poetry',
    pdm: 'pdm',
    uv: 'uv',
    pipenv: 'pipenv',
    setuptools: 'setuptools',
  };

  return aliases[normalized] ?? null;
}

function normalizeExecutionProfile(
  value: unknown,
): PythonExecutionProfile | null {
  const normalized = normalizeOptionalString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  const aliases: Record<string, PythonExecutionProfile> = {
    'cli-script': 'cli-script',
    cli: 'cli-script',
    'module-cli': 'module-cli',
    module: 'module-cli',
    'web-asgi': 'web-asgi',
    asgi: 'web-asgi',
    'web-wsgi': 'web-wsgi',
    wsgi: 'web-wsgi',
    'django-service': 'django-service',
    django: 'django-service',
    'batch-worker': 'batch-worker',
    worker: 'batch-worker',
    batch: 'batch-worker',
    'custom-manifest': 'custom-manifest',
    custom: 'custom-manifest',
  };

  return aliases[normalized] ?? null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}
