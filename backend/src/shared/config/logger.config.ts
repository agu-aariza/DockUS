import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Cabecera de correlación. Se acepta entrante para poder enlazar con la traza
 * de un proxy o de un balanceador que ya la haya emitido, y se devuelve siempre
 * en la respuesta para que un usuario que reporta una incidencia pueda aportar
 * el identificador exacto de su petición.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Tope defensivo: la cabecera la controla el cliente y acaba en los registros. */
const MAX_CORRELATION_ID_LENGTH = 128;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Resuelve el identificador de correlación de una petición entrante.
 *
 * Se sanea antes de aceptarlo: el valor procede de una cabecera controlada por
 * el cliente y termina escrito en los registros, de modo que sin filtro un
 * remitente podría inyectar saltos de línea y fabricar entradas de registro
 * falsas. Cualquier valor que no encaje se descarta y se genera uno nuevo, que
 * es preferible a rechazar la petición: la correlación es una ayuda de
 * diagnóstico, no un control de acceso.
 */
export function resolveCorrelationId(headerValue: unknown): string {
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

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
 * Normaliza el `reqId` de pino-http (`string | number | object`) a texto.
 *
 * Devuelve `undefined` en lugar de un texto vacío o de `"[object Object]"`
 * cuando no hay un identificador utilizable: quien lo consume trata la ausencia
 * como "este trabajo no nace de una petición HTTP", que es exactamente lo que
 * significa, mientras que una cadena degenerada contaminaría los registros con
 * un valor que aparenta ser una correlación real.
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

export function buildPinoHttpConfig(nodeEnv: string | undefined) {
  const isProduction = nodeEnv === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },

    // `genReqId` fija el `reqId` que pino-http añade a toda línea registrada
    // dentro de la petición. Devolverlo en la respuesta es lo que cierra el
    // círculo: el identificador que ve el usuario es el mismo que aparece en
    // los registros del servidor y, si la petición encola una evaluación,
    // también en los del worker.
    genReqId: (req: IncomingMessage, res: ServerResponse): string => {
      const correlationId = resolveCorrelationId(
        req.headers[CORRELATION_ID_HEADER],
      );
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
      return correlationId;
    },
  };
}
