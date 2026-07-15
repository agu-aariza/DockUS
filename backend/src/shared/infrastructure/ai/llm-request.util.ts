/**
 * @fileoverview Errores y utilidades comunes a todos los proveedores de LLM.
 *
 * Contexto:
 * - `LlmRequestError` es el único error que los adaptadores dejan escapar; el
 *   Builder lo serializa en el trace de la etapa y decide si reintenta.
 * - `bedrock-request.util.ts` reexporta esta clase como `BedrockRequestError`
 *   para no romper a los consumidores previos al soporte multi-proveedor.
 *
 * @module LlmRequestUtil
 */

export type LlmRequestErrorCode =
  | 'connectivity'
  | 'model_not_found'
  | 'timeout'
  | 'http_error'
  | 'throttling'
  | 'invalid_response'
  | 'invalid_contract'
  | 'missing_credentials'
  | 'unsupported_provider'
  | 'unknown';

interface LlmRequestErrorInit {
  code: LlmRequestErrorCode;
  message: string;
  httpStatus?: number | null;
}

export class LlmRequestError extends Error {
  readonly code: LlmRequestErrorCode;
  readonly httpStatus: number | null;

  constructor({ code, message, httpStatus = null }: LlmRequestErrorInit) {
    super(message);
    this.name = 'LlmRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function createLlmInvalidResponseError(
  message: string,
): LlmRequestError {
  return new LlmRequestError({ code: 'invalid_response', message });
}

export function createMissingCredentialsError(
  providerName: string,
  field: string,
): LlmRequestError {
  return new LlmRequestError({
    code: 'missing_credentials',
    message: `Falta "${field}" en la configuración de ${providerName}. Complétalo en la pestaña "Modelos de IA".`,
  });
}

/** Traduce un error HTTP del proveedor al código de dominio correspondiente. */
export function mapHttpStatusToLlmError(
  providerName: string,
  status: number,
  body: string,
): LlmRequestError {
  const detail = body.slice(0, 500);

  if (status === 401 || status === 403) {
    return new LlmRequestError({
      code: 'http_error',
      httpStatus: status,
      message: `${providerName} ha rechazado las credenciales (HTTP ${status}): ${detail}`,
    });
  }

  if (status === 404) {
    return new LlmRequestError({
      code: 'model_not_found',
      httpStatus: status,
      message: `${providerName} no reconoce el modelo o el endpoint solicitado (HTTP 404): ${detail}`,
    });
  }

  if (status === 429) {
    return new LlmRequestError({
      code: 'throttling',
      httpStatus: status,
      message: `${providerName} ha limitado la solicitud (HTTP 429): ${detail}`,
    });
  }

  return new LlmRequestError({
    code: 'http_error',
    httpStatus: status,
    message: `${providerName} ha respondido con HTTP ${status}: ${detail}`,
  });
}

/** Traduce un fallo de transporte (DNS, TLS, abort) al código de dominio. */
export function mapTransportError(
  providerName: string,
  error: unknown,
): LlmRequestError {
  if (error instanceof LlmRequestError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new LlmRequestError({
        code: 'timeout',
        message: `Timeout agotado en ${providerName}: ${error.message}`,
      });
    }

    return new LlmRequestError({
      code: 'connectivity',
      message: `No se pudo contactar con ${providerName}: ${error.message}`,
    });
  }

  return new LlmRequestError({
    code: 'unknown',
    message: `Error desconocido en ${providerName}: ${String(error)}`,
  });
}

/**
 * `fetch` con timeout duro. Los proveedores HTTP no exponen un cliente con
 * cancelación propia, así que el corte lo impone el `AbortController`.
 */
export async function postJson(
  providerName: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapHttpStatusToLlmError(
        providerName,
        response.status,
        await response.text().catch(() => ''),
      );
    }

    return await response.json();
  } catch (error) {
    throw mapTransportError(providerName, error);
  } finally {
    clearTimeout(timer);
  }
}

/** Concatena base y ruta sin duplicar ni perder la barra intermedia. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
