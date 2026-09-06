/**
 * @fileoverview Traducción de errores del SDK de Bedrock al error común de LLM.
 *
 * `BedrockRequestError` es un alias de `LlmRequestError`: desde el soporte
 * multi-proveedor todos los adaptadores comparten la misma clase de error, y el
 * alias evita reescribir los `instanceof` y los tests existentes.
 *
 * @module BedrockRequestUtil
 */

import { LlmRequestError } from './llm-request.util';

export {
  LlmRequestError,
  LlmRequestError as BedrockRequestError,
  createLlmInvalidResponseError as createBedrockInvalidResponseError,
} from './llm-request.util';

export function mapBedrockError(error: unknown): LlmRequestError {
  if (error instanceof LlmRequestError) {
    return error;
  }

  if (error instanceof Error) {
    const name = error.name;

    if (name === 'AbortError' || error.message.includes('aborted')) {
      return new LlmRequestError({
        code: 'timeout',
        message: `Timeout agotado en Amazon Bedrock: ${error.message}`,
      });
    }

    if (name === 'ThrottlingException') {
      return new LlmRequestError({
        code: 'throttling',
        message: `Amazon Bedrock ha limitado la solicitud (throttling): ${error.message}`,
      });
    }

    if (
      name === 'ResourceNotFoundException' ||
      name === 'ModelNotFoundException'
    ) {
      return new LlmRequestError({
        code: 'model_not_found',
        message: `El modelo solicitado no está disponible en Amazon Bedrock: ${error.message}`,
      });
    }

    if (name === 'AccessDeniedException' || name === 'UnauthorizedException') {
      return new LlmRequestError({
        code: 'http_error',
        httpStatus: 403,
        message: `Acceso denegado a Amazon Bedrock. Verifica las credenciales AWS y los permisos IAM: ${error.message}`,
      });
    }

    return new LlmRequestError({
      code: 'connectivity',
      message: `Error inesperado al comunicarse con Amazon Bedrock: ${error.message}`,
    });
  }

  return new LlmRequestError({
    code: 'unknown',
    message: `Error desconocido en Amazon Bedrock: ${String(error)}`,
  });
}
