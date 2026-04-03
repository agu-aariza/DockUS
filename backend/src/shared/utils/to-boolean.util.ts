/**
 * @fileoverview Utilidad para conversión de valores a booleano.
 *
 * Contexto:
 * - Centraliza la conversión de strings de configuración a boolean.
 * - Evita duplicar el mismo helper en múltiples servicios.
 *
 * @module ToBooleanUtil
 */

/**
 * Convierte un valor de configuración (string | boolean) a boolean.
 *
 * Interpreta "true" (case-insensitive) como true, cualquier otro string como false.
 */
export function toBoolean(value: string | boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return value.toLowerCase() === 'true';
}
