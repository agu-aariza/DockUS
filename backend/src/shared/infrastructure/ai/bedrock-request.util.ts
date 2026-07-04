type BedrockRequestErrorCode =
  | 'connectivity'
  | 'model_not_found'
  | 'timeout'
  | 'http_error'
  | 'throttling'
  | 'invalid_response'
  | 'invalid_contract'
  | 'unknown';

interface BedrockRequestErrorInit {
  code: BedrockRequestErrorCode;
  message: string;
  httpStatus?: number | null;
}

export class BedrockRequestError extends Error {
  readonly code: BedrockRequestErrorCode;
  readonly httpStatus: number | null;

  constructor({ code, message, httpStatus = null }: BedrockRequestErrorInit) {
    super(message);
    this.name = 'BedrockRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function createBedrockInvalidResponseError(
  message: string,
): BedrockRequestError {
  return new BedrockRequestError({
    code: 'invalid_response',
    message,
  });
}

export function mapBedrockError(error: unknown): BedrockRequestError {
  if (error instanceof BedrockRequestError) {
    return error;
  }

  if (error instanceof Error) {
    const name = error.name;

    if (name === 'AbortError' || error.message.includes('aborted')) {
      return new BedrockRequestError({
        code: 'timeout',
        message: `Timeout agotado en Amazon Bedrock: ${error.message}`,
      });
    }

    if (name === 'ThrottlingException') {
      return new BedrockRequestError({
        code: 'throttling',
        message: `Amazon Bedrock ha limitado la solicitud (throttling): ${error.message}`,
      });
    }

    if (
      name === 'ResourceNotFoundException' ||
      name === 'ModelNotFoundException'
    ) {
      return new BedrockRequestError({
        code: 'model_not_found',
        message: `El modelo solicitado no está disponible en Amazon Bedrock: ${error.message}`,
      });
    }

    if (name === 'AccessDeniedException' || name === 'UnauthorizedException') {
      return new BedrockRequestError({
        code: 'http_error',
        httpStatus: 403,
        message: `Acceso denegado a Amazon Bedrock. Verifica las credenciales AWS y los permisos IAM: ${error.message}`,
      });
    }

    return new BedrockRequestError({
      code: 'connectivity',
      message: `Error inesperado al comunicarse con Amazon Bedrock: ${error.message}`,
    });
  }

  return new BedrockRequestError({
    code: 'unknown',
    message: `Error desconocido en Amazon Bedrock: ${String(error)}`,
  });
}
