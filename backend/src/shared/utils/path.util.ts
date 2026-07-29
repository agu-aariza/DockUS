/**
 * @fileoverview Normalización de rutas (path.util).
 *
 * @module path.util
 */

/**
 * Normaliza una ruta a formato POSIX (utilizando / como separador).
 */
export function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}
