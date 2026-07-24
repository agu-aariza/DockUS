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
): BuilderLlmStageTrace<TContract> {
  return {
    schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
    ...snapshot,
    rawResponse,
    parsedContract,
    error,
    usage,
  };
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
