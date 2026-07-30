/**
 * @fileoverview Configuración del registrador de logs Pino (`pino-http`) e id de correlación.
 *
 * @description
 * Proporciona el middleware de logging estructurado JSON para producción y formato bonito
 * (`pino-pretty`) para desarrollo. Implementa la propagación de la cabecera `x-correlation-id`
 * para la trazabilidad completa entre peticiones HTTP y ejecuciones asíncronas de workers.
 *
 * @module LoggerConfig
 */

import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

/** Cabecera HTTP estándar para la propagación del identificador de correlación. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Longitud máxima permitida para la cabecera de correlación para prevenir Log Injection. */
const MAX_CORRELATION_ID_LENGTH = 128;

/** Expresión regular de caracteres seguros en el ID de correlación. */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Resuelve y sanitiza el identificador de correlación de una petición HTTP entrante.
 *
 * @param headerValue - Valor crudo de la cabecera HTTP recibida.
 * @returns ID de correlación válido (existente sanitizado o un nuevo UUID v4).
 */
export function resolveCorrelationId(headerValue: unknown): string {
  // `Array.isArray` narrows `unknown` a `any[]` (lib.es5.d.ts), no a
  // `unknown[]`; se recupera el tipo explícitamente antes de indexar.
  const candidate: unknown = Array.isArray(headerValue)
    ? (headerValue as unknown[])[0]
    : headerValue;

  if (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    candidate.length <= MAX_CORRELATION_ID_LENGTH &&
    SAFE_CORRELATION_ID.test(candidate)
  ) {
    return candidate;
  }

  return randomUUID();
}

/**
 * Normaliza un identificador de petición arbitrario a una cadena de correlación utilizable.
 *
 * @param reqId - Identificador crudo asignado por pino-http.
 * @returns Cadena de texto o undefined si no hay un ID válido.
 */
export function toCorrelationId(reqId: unknown): string | undefined {
  if (typeof reqId === 'string' && reqId.length > 0) {
    return reqId;
  }
  if (typeof reqId === 'number') {
    return String(reqId);
  }
  return undefined;
}

/**
 * Construye las opciones de configuración para el middleware `pino-http`.
 *
 * @param nodeEnv - Entorno de ejecución (`development`, `production`, `test`).
 * @returns Objeto de configuración de Pino.
 */
export function buildPinoHttpConfig(nodeEnv: string | undefined) {
  const isProduction = nodeEnv === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },

    genReqId: (req: IncomingMessage, res: ServerResponse): string => {
      const correlationId = resolveCorrelationId(
        req.headers[CORRELATION_ID_HEADER],
      );
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
      return correlationId;
    },
  };
}
