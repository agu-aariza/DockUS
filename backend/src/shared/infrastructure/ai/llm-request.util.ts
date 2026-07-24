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

/** Reintentos por defecto para `postJson`: solo Bedrock tenia backoff propio (SDK de AWS); el resto de proveedores fallaban permanentemente ante un 429/5xx transitorio. */
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 300;

function isRetryableLlmError(error: LlmRequestError): boolean {
  if (error.code === 'throttling' || error.code === 'connectivity') {
    return true;
  }
  return (
    error.code === 'http_error' &&
    typeof error.httpStatus === 'number' &&
    error.httpStatus >= 500
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `fetch` con timeout duro. Los proveedores HTTP no exponen un cliente con
 * cancelación propia, así que el corte lo impone el `AbortController`.
 */
async function postJsonOnce(
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

/**
 * Reintenta `postJsonOnce` con backoff exponencial + jitter ante errores
 * transitorios (throttling, conectividad, 5xx). Errores no reintentables
 * (401/403/404, contrato invalido, etc.) fallan de inmediato en el primer
 * intento. `maxAttempts` es opcional para no romper a los llamadores
 * existentes que ya pasaban solo los primeros 5 parametros.
 */
export async function postJson(
  providerName: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<unknown> {
  let lastError: LlmRequestError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await postJsonOnce(providerName, url, headers, body, timeoutMs);
    } catch (error) {
      const llmError = error as LlmRequestError;
      lastError = llmError;
      if (attempt === maxAttempts || !isRetryableLlmError(llmError)) {
        throw llmError;
      }
      const backoffMs = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(
        backoffMs + Math.floor(Math.random() * DEFAULT_RETRY_BASE_DELAY_MS),
      );
    }
  }
  throw (
    lastError ??
    mapTransportError(providerName, new Error('Fallo desconocido en postJson.'))
  );
}

/** Concatena base y ruta sin duplicar ni perder la barra intermedia. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
