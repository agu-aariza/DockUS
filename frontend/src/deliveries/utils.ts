/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (utils).
 *
 * @module utils
 */

export function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
}
