import { Logger } from '@nestjs/common';
import {
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageErrorInfo,
  BuilderLlmStageTrace,
  BUILDER_LLM_SCHEMA_VERSION,
} from '../builder.types';
import type { LlmModelProfile } from '../../../../../shared/infrastructure/ai/llm.types';
import type { PromptId } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import type { ComposedPromptPayload } from './builder-prompt-composer';
import { BedrockRequestError } from '../../../../../shared/infrastructure/ai/bedrock-request.util';

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
): BuilderLlmStageTrace<TContract> {
  return {
    schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
    ...snapshot,
    rawResponse,
    parsedContract,
    error,
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
