import { readFile } from 'fs/promises';
import * as path from 'path';
import {
  ABSOLUTE_PATH_PATTERNS,
  ALLOWED_CONSTRUCTORS,
  TEXT_SCAN_EXTENSIONS,
} from '../builder.constants';
import {
  AbsolutePathFinding,
  BuilderQualityResult,
  BuilderStackResult,
  RuntimeFile,
} from '../builder.types';

interface DetectProjectContextResult {
  stack: BuilderStackResult;
  warnings: string[];
}

export function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}

export function isUnsafeRelativePath(relativePath: string): boolean {
  const normalized = toPosixPath(relativePath).trim();
  if (!normalized) return true;

  const isWindowsAbsolute = /^[A-Za-z]:\//.test(normalized);
  const isUnixAbsolute = normalized.startsWith('/');
  const segments = normalized.split('/');
  const hasTraversal = segments.includes('..');

  return isWindowsAbsolute || isUnixAbsolute || hasTraversal;
}

export function buildSafeDestination(
  rootDir: string,
  relativePath: string,
): string {
  const normalized = toPosixPath(relativePath).trim();
  if (isUnsafeRelativePath(normalized)) {
    throw new Error(
      `Ruta invalida detectada durante preparacion de artefactos: "${relativePath}".`,
    );
  }

  const destination = path.resolve(rootDir, normalized);
  const rootResolved = path.resolve(rootDir);
  const rootWithSep = `${rootResolved}${path.sep}`;

  if (destination !== rootResolved && !destination.startsWith(rootWithSep)) {
    throw new Error(
      `Ruta fuera de workspace detectada durante preparacion de artefactos: "${relativePath}".`,
    );
  }

  return destination;
}

export async function detectPythonProjectContext(
  runtimeFiles: RuntimeFile[],
  defaultPythonVersion: string,
): Promise<DetectProjectContextResult> {
  const warnings: string[] = [];
  const sortedFiles = [...runtimeFiles].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );
  const pythonFiles = sortedFiles.filter((file) =>
    file.relativePath.toLowerCase().endsWith('.py'),
  );

  const requirementsTxt = pickRootPreferredFile(
    sortedFiles,
    'requirements.txt',
  );
  const pyprojectToml = pickRootPreferredFile(sortedFiles, 'pyproject.toml');
  const runtimeTxt = pickRootPreferredFile(sortedFiles, 'runtime.txt');

  if (!pythonFiles.length && !requirementsTxt && !pyprojectToml) {
    throw new Error(
      'No se detectaron señales de proyecto Python (archivos .py o manifiestos).',
    );
  }

  if (requirementsTxt && pyprojectToml) {
    warnings.push(
      'Se detectaron requirements.txt y pyproject.toml; se prioriza requirements.txt para instalacion.',
    );
  }

  const entrypoint = await detectEntrypoint(pythonFiles);
  if (!entrypoint) {
    throw new Error(
      'No se detecto punto de entrada Python para generar el Dockerfile.',
    );
  }

  const pyprojectContent = pyprojectToml
    ? await readFile(pyprojectToml.absolutePath, 'utf8')
    : null;
  const runtimeContent = runtimeTxt
    ? await readFile(runtimeTxt.absolutePath, 'utf8')
    : null;

  const parsedPyVersion = parsePyprojectPythonVersion(pyprojectContent);
  const parsedRuntimeVersion = parseRuntimePythonVersion(runtimeContent);
  const pythonVersion =
    parsedPyVersion ?? parsedRuntimeVersion ?? defaultPythonVersion;
  const defaultedPythonVersion = !parsedPyVersion && !parsedRuntimeVersion;

  return {
    stack: {
      language: 'python',
      pythonVersion,
      defaultedPythonVersion,
      manifests: {
        requirementsTxt: requirementsTxt?.relativePath ?? null,
        pyprojectToml: pyprojectToml?.relativePath ?? null,
        runtimeTxt: runtimeTxt?.relativePath ?? null,
        chosen: requirementsTxt
          ? 'requirements.txt'
          : pyprojectToml
            ? 'pyproject.toml'
            : null,
      },
      entrypoint,
      pythonFiles: pythonFiles.length,
    },
    warnings,
  };
}

export async function scanAbsolutePathsInFiles(
  runtimeFiles: RuntimeFile[],
): Promise<AbsolutePathFinding[]> {
  const findings: AbsolutePathFinding[] = [];

  for (const file of runtimeFiles) {
    if (!shouldScanAsText(file.relativePath)) {
      continue;
    }

    const content = await readFile(file.absolutePath);
    if (content.includes(0)) {
      continue;
    }

    const lines = content.toString('utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of ABSOLUTE_PATH_PATTERNS) {
        pattern.lastIndex = 0;
        let match = pattern.exec(line);
        while (match) {
          findings.push({
            file: file.relativePath,
            line: index + 1,
            match: match[0],
          });
          match = pattern.exec(line);
        }
      }
    });
  }

  return findings;
}

export function normalizeDockerfileResponse(rawResponse: string): string {
  const normalized = stripMarkdownCodeFence(rawResponse).trim();
  if (!normalized) {
    throw new Error('La respuesta del modelo para Dockerfile vino vacia.');
  }

  if (!/^FROM\s+/m.test(normalized)) {
    throw new Error('Dockerfile invalido: falta instruccion FROM.');
  }

  if (!/^WORKDIR\s+\/app$/m.test(normalized)) {
    throw new Error('Dockerfile invalido: falta WORKDIR /app.');
  }

  if (!/^CMD\s+/m.test(normalized)) {
    throw new Error('Dockerfile invalido: falta instruccion CMD.');
  }

  return normalized;
}

export function parseQualityResponse(
  rawResponse: string,
): BuilderQualityResult {
  const normalized = stripMarkdownCodeFence(rawResponse).trim();
  if (!normalized) {
    throw new Error('La respuesta de calidad vino vacia.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error('El analisis de calidad no devolvio JSON valido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El analisis de calidad debe devolver un objeto JSON.');
  }

  const keys = Object.keys(parsed);
  if (
    keys.length !== 2 ||
    !keys.includes('classes') ||
    !keys.includes('summary')
  ) {
    throw new Error(
      'El analisis de calidad debe contener exactamente las claves classes y summary.',
    );
  }

  const classesValue = (parsed as { classes: unknown }).classes;
  const summaryValue = (parsed as { summary: unknown }).summary;

  if (!Array.isArray(classesValue)) {
    throw new Error('El campo classes debe ser un arreglo.');
  }

  if (typeof summaryValue !== 'string') {
    throw new Error('El campo summary debe ser string.');
  }

  const classes = classesValue.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`La clase #${index + 1} no es un objeto valido.`);
    }

    const objectEntry = entry as {
      name?: unknown;
      constructor?: unknown;
      issues?: unknown;
    };
    const entryKeys = Object.keys(objectEntry);

    if (
      entryKeys.length !== 3 ||
      !entryKeys.includes('name') ||
      !entryKeys.includes('constructor') ||
      !entryKeys.includes('issues')
    ) {
      throw new Error(
        `La clase #${index + 1} debe contener exactamente name, constructor e issues.`,
      );
    }

    if (typeof objectEntry.name !== 'string' || !objectEntry.name.trim()) {
      throw new Error(`La clase #${index + 1} tiene name invalido.`);
    }

    if (
      typeof objectEntry.constructor !== 'string' ||
      !ALLOWED_CONSTRUCTORS.has(objectEntry.constructor)
    ) {
      throw new Error(
        `La clase #${index + 1} tiene constructor fuera de schema permitido.`,
      );
    }

    if (
      !Array.isArray(objectEntry.issues) ||
      objectEntry.issues.some((issue) => typeof issue !== 'string')
    ) {
      throw new Error(`La clase #${index + 1} tiene issues invalidos.`);
    }

    const issues = objectEntry.issues as string[];
    const constructorKind = objectEntry.constructor as
      | 'parametrized'
      | 'non-parametrized'
      | 'implicit';
    return {
      name: objectEntry.name.trim(),
      constructor: constructorKind,
      issues: issues.map((issue) => issue.trim()),
    };
  });

  return {
    classes,
    summary: summaryValue.trim(),
  };
}

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z]*\s*/u, '')
    .replace(/```$/u, '')
    .trim();
}

function shouldScanAsText(relativePath: string): boolean {
  const extension = path.extname(relativePath).toLowerCase();
  return TEXT_SCAN_EXTENSIONS.has(extension);
}

function pickRootPreferredFile(
  files: RuntimeFile[],
  expectedName: string,
): RuntimeFile | null {
  const normalizedName = expectedName.toLowerCase();
  const matches = files.filter(
    (file) =>
      path.posix.basename(file.relativePath).toLowerCase() === normalizedName,
  );
  if (!matches.length) {
    return null;
  }

  matches.sort((a, b) => {
    const depthA = a.relativePath.split('/').length;
    const depthB = b.relativePath.split('/').length;
    if (depthA === depthB) {
      return a.relativePath.localeCompare(b.relativePath);
    }
    return depthA - depthB;
  });

  return matches[0];
}

async function detectEntrypoint(
  pythonFiles: RuntimeFile[],
): Promise<string | null> {
  if (!pythonFiles.length) {
    return null;
  }

  const preferredCandidates = new Set([
    'main.py',
    'app.py',
    'src/main.py',
    'src/app.py',
  ]);

  const preferred = pythonFiles.find((file) =>
    preferredCandidates.has(file.relativePath.toLowerCase()),
  );
  if (preferred) {
    return preferred.relativePath;
  }

  for (const file of pythonFiles) {
    const content = await readFile(file.absolutePath, 'utf8');
    if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(content)) {
      return file.relativePath;
    }
  }

  return pythonFiles[0].relativePath;
}

function parsePyprojectPythonVersion(content: string | null): string | null {
  if (!content) {
    return null;
  }

  const match = content.match(/requires-python\s*=\s*["']([^"']+)["']/i);
  if (!match?.[1]) {
    return null;
  }

  const versionCandidate = match[1].match(/(\d+\.\d+(?:\.\d+)?)/);
  return versionCandidate?.[1] ?? null;
}

function parseRuntimePythonVersion(content: string | null): string | null {
  if (!content) {
    return null;
  }

  const firstLine = content.split(/\r?\n/)[0]?.trim() ?? '';
  const versionCandidate = firstLine.match(/(\d+\.\d+(?:\.\d+)?)/);
  return versionCandidate?.[1] ?? null;
}
