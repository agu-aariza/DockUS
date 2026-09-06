/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-llm-trace.util).
 *
 * @module builder-llm-trace.util
 */

import { Logger } from '@nestjs/common';
import {
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageErrorInfo,
  BuilderLlmStageTrace,
  BuilderLlmStageAttempt,
  BuilderStageTokenUsage,
  BUILDER_LLM_SCHEMA_VERSION,
} from '../../../domain/builder.types';
import type {
  LlmModelProfile,
  LlmUsage,
} from '../../../../../../shared/infrastructure/ai/llm.types';
import type { PromptId } from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import type { ComposedPromptPayload } from '../../../domain/ai/builder-prompt-composer';
import { BedrockRequestError } from '../../../../../../shared/infrastructure/ai/bedrock-request.util';

export function createPromptSnapshot(
  stage: BuilderLlmStagePromptSnapshot['stage'],
  promptId: PromptId,
  modelProfile: LlmModelProfile,
  prompt: ComposedPromptPayload,
  systemPrompt: string | null,
): BuilderLlmStagePromptSnapshot {
  return {
    stage,
    promptId,
    model: modelProfile.modelId,
    systemPrompt,
    prompt: prompt.prompt,
    sections: prompt.sections,
    modelProfile,
    createdAt: new Date().toISOString(),
  };
}

export function logStageError(
  stage: BuilderLlmStagePromptSnapshot['stage'],
  promptId: PromptId,
  modelProfile: LlmModelProfile,
  error: BuilderLlmStageErrorInfo,
  logger: Logger,
): void {
  logger.error(
    JSON.stringify({
      event: 'builder_llm_stage_error',
      stage,
      promptId,
      modelId: modelProfile.modelId,
      profileVersion: modelProfile.profileVersion,
      code: error.code ?? 'unknown',
      httpStatus: error.httpStatus ?? null,
      message: error.message,
    }),
  );
}

export function buildTrace<TContract>(
  snapshot: BuilderLlmStagePromptSnapshot,
  rawResponse: string | null,
  error: BuilderLlmStageErrorInfo | null,
  parsedContract: TContract | null = null,
  usage?: LlmUsage,
  attempts?: BuilderLlmStageAttempt[],
): BuilderLlmStageTrace<TContract> {
  return {
    schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
    ...snapshot,
    rawResponse,
    parsedContract,
    error,
    usage,
    ...(attempts && attempts.length > 0 ? { attempts } : {}),
  };
}

/**
 * Suma dos lecturas de `usage` de intentos distintos del mismo contrato:
 * ambos intentos se facturan y ambos deben contar. El trace final conserva
 * los tokens y el coste acumulados de cada intento. Si
 * ambos lados son `null` (ningún intento declaró consumo), el resultado
 * sigue siendo `null` — desconocido, no cero — en vez de convertirse en 0
 * por la suma.
 */
export function sumUsage(
  a: LlmUsage | undefined,
  b: LlmUsage | undefined,
): LlmUsage | undefined {
  if (!a) return b;
  if (!b) return a;

  return {
    inputTokens: sumTokenCount(a.inputTokens, b.inputTokens),
    outputTokens: sumTokenCount(a.outputTokens, b.outputTokens),
  };
}

function sumTokenCount(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Extrae el consumo facturable de un trace. Devuelve null si el proveedor no
 * declaró tokens (fallo antes de llegar al modelo, o respuesta sin `usage`).
 */
export function toStageTokenUsage(
  trace: BuilderLlmStageTrace<unknown> | null | undefined,
): BuilderStageTokenUsage | null {
  const inputTokens = trace?.usage?.inputTokens ?? 0;
  const outputTokens = trace?.usage?.outputTokens ?? 0;

  if (!trace || (inputTokens === 0 && outputTokens === 0)) {
    return null;
  }

  return {
    stage: trace.stage,
    providerId: trace.modelProfile.providerId,
    modelId: trace.modelProfile.modelId,
    inputTokens,
    outputTokens,
  };
}

export function serializeError(
  error: unknown,
  fallbackCode?: string,
): BuilderLlmStageErrorInfo {
  if (error instanceof BedrockRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      stack: error.stack ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      code: fallbackCode,
      message: error.message,
      httpStatus: null,
      stack: error.stack ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    name: 'UnknownError',
    code: fallbackCode ?? 'unknown',
    message: String(error),
    httpStatus: null,
    stack: null,
    timestamp: new Date().toISOString(),
  };
}
