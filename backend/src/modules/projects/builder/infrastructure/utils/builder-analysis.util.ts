import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import * as path from 'path';
import {
  ABSOLUTE_PATH_PATTERNS,
  TEST_DISCOVERY_PATTERNS,
  TEXT_SCAN_EXTENSIONS,
} from '../../domain/builder.constants';
import { RuntimeFile } from '../../domain/builder.types';

export interface AbsolutePathFinding {
  file: string;
  line: number;
  match: string;
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

export function pickRootPreferredFile(
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

export function listPythonFiles(files: RuntimeFile[]): RuntimeFile[] {
  return files
    .filter((file) => file.relativePath.toLowerCase().endsWith('.py'))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function readTextFileSafe(absolutePath: string): Promise<string> {
  const fileBuffer = await readFile(absolutePath);
  if (fileBuffer.includes(0)) {
    return '';
  }
  return fileBuffer.toString('utf8');
}

export async function detectEntrypointCandidates(
  pythonFiles: RuntimeFile[],
): Promise<string[]> {
  const preferredCandidates = new Set([
    'main.py',
    'app.py',
    'src/main.py',
    'src/app.py',
  ]);
  const candidates = new Set<string>();

  for (const file of pythonFiles) {
    if (preferredCandidates.has(file.relativePath.toLowerCase())) {
      candidates.add(file.relativePath);
    }
  }

  for (const file of pythonFiles) {
    const content = await readTextFileSafe(file.absolutePath);
    if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(content)) {
      candidates.add(file.relativePath);
    }
  }

  if (candidates.size === 0 && pythonFiles.length > 0) {
    candidates.add(pythonFiles[0].relativePath);
  }

  return [...candidates].sort((a, b) => a.localeCompare(b));
}

export function detectTestsPresent(files: RuntimeFile[]): boolean {
  return files.some((file) =>
    TEST_DISCOVERY_PATTERNS.some((pattern) => pattern.test(file.relativePath)),
  );
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

export function toPythonModuleFromFile(relativePath: string): string {
  const normalized = toPosixPath(relativePath)
    .replace(/\.py$/i, '')
    .replace(/^\.\//, '');
  return normalized.split('/').join('.');
}

export function toSha256Hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function shouldScanAsText(relativePath: string): boolean {
  const extension = path.extname(relativePath).toLowerCase();
  return TEXT_SCAN_EXTENSIONS.has(extension);
}
