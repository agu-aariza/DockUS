/**
 * @fileoverview Extracción del mensaje de un error de tipo desconocido.
 *
 * Función pura y sin dependencias (conforme a la regla de `shared/utils/`).
 * Centraliza la lógica que varios servicios duplicaban: devolver `error.message`
 * cuando es un `Error`, o un mensaje de reserva en cualquier otro caso.
 *
 * @module error-message.util
 */

export function toErrorMessage(
  error: unknown,
  fallback = 'Error no tipado.',
): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
