export type OllamaRequestErrorCode =
  | 'connectivity'
  | 'model_not_found'
  | 'timeout'
  | 'http_error'
  | 'invalid_response'
  | 'invalid_contract'
  | 'unknown';

interface OllamaRequestErrorInit {
  code: OllamaRequestErrorCode;
  message: string;
  httpStatus?: number | null;
}

export class OllamaRequestError extends Error {
  readonly code: OllamaRequestErrorCode;
  readonly httpStatus: number | null;

  constructor({ code, message, httpStatus = null }: OllamaRequestErrorInit) {
    super(message);
    this.name = 'OllamaRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function createOllamaConnectivityError(
  baseUrl: string,
  error: unknown,
): OllamaRequestError {
  const detail = error instanceof Error ? error.message : String(error);
  return new OllamaRequestError({
    code: 'connectivity',
    message: `No se pudo conectar con Ollama en ${baseUrl}: ${detail}`,
  });
}

export function createOllamaTimeoutError(
  baseUrl: string,
  action: string,
): OllamaRequestError {
  return new OllamaRequestError({
    code: 'timeout',
    message: `Timeout agotado al ${action} contra Ollama en ${baseUrl}.`,
  });
}

export function createOllamaHttpError(params: {
  baseUrl: string;
  target: string;
  status: number;
  details: string;
}): OllamaRequestError {
  const trimmedDetails = params.details.slice(0, 250);
  if (
    params.status === 404 &&
    /model\s+['"`]?.+['"`]?\s+not found/iu.test(trimmedDetails)
  ) {
    return new OllamaRequestError({
      code: 'model_not_found',
      httpStatus: params.status,
      message: `El modelo Ollama ${params.target} no está disponible en ${params.baseUrl}: ${trimmedDetails}`,
    });
  }

  return new OllamaRequestError({
    code: 'http_error',
    httpStatus: params.status,
    message: `Ollama devolvió ${params.status} para ${params.target} en ${params.baseUrl}: ${trimmedDetails}`,
  });
}

export function createOllamaInvalidResponseError(
  message: string,
): OllamaRequestError {
  return new OllamaRequestError({
    code: 'invalid_response',
    message,
  });
}

export function normalizeOllamaModelNames(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    return [];
  }

  const names = models
    .map((model) => {
      if (!model || typeof model !== 'object') {
        return null;
      }

      const candidate =
        (model as { name?: unknown; model?: unknown }).name ??
        (model as { name?: unknown; model?: unknown }).model;

      return typeof candidate === 'string' ? candidate.trim() : null;
    })
    .filter((name): name is string => Boolean(name));

  return [...new Set(names)];
}

export function hasOllamaModel(
  availableModels: string[],
  requiredModel: string,
): boolean {
  return availableModels.some(
    (availableModel) =>
      availableModel === requiredModel ||
      availableModel.startsWith(`${requiredModel}:`),
  );
}
