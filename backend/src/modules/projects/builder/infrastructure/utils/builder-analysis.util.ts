/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-analysis.util).
 *
 * @module builder-analysis.util
 */

import * as path from 'path';
import { toPosixPath } from '../../../../../shared/utils/path.util';

/**
 * Determina si una ruta relativa es insegura (intenta salir del directorio o es absoluta).
 */
export function isUnsafeRelativePath(relativePath: string): boolean {
  const normalized = toPosixPath(relativePath).trim();
  if (!normalized) return true;

  const isWindowsAbsolute = /^[A-Za-z]:\//.test(normalized);
  const isUnixAbsolute = normalized.startsWith('/');
  const segments = normalized.split('/');
  const hasTraversal = segments.includes('..');

  return isWindowsAbsolute || isUnixAbsolute || hasTraversal;
}

/**
 * Construye una ruta de destino segura dentro de un root, validando contra escapes.
 */
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
