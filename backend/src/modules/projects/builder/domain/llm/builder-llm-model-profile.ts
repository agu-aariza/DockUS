import { ConfigService } from '@nestjs/config';
import {
  BuilderLlmPromptStage,
  OllamaModelProfile,
} from '../../../../../shared/infrastructure/ai/ollama-generation.service';

const PROFILE_VERSION = 'builder-llm-profile/v1';

const DEFAULT_NUM_CTX: Record<BuilderLlmPromptStage, number> = {
  plan: 8192,
  evaluation: 16384,
  quality: 16384,
  chat: 16384,
};

const DEFAULT_TEMPERATURE: Record<BuilderLlmPromptStage, number> = {
  plan: 0.1,
  evaluation: 0.2,
  quality: 0.3,
  chat: 0.5,
};

const DEFAULT_TOP_P: Record<BuilderLlmPromptStage, number> = {
  plan: 0.9,
  evaluation: 0.9,
  quality: 0.9,
  chat: 0.9,
};

const DEFAULT_REPEAT_PENALTY: Record<BuilderLlmPromptStage, number> = {
  plan: 1.1,
  evaluation: 1.1,
  quality: 1.1,
  chat: 1.1,
};

const DEFAULT_NUM_PREDICT: Record<BuilderLlmPromptStage, number> = {
  plan: 4096,
  evaluation: 8192,
  quality: 8192,
  chat: 8192,
};

const DEFAULT_KEEP_ALIVE_SECONDS = 300;
const DEFAULT_STOP_TOKENS = ['<|endoftext|>'];

const DEFAULT_TIMEOUT_MS: Record<BuilderLlmPromptStage, number> = {
  plan: 120_000,
  evaluation: 300_000,
  quality: 300_000,
  chat: 300_000,
};

export function resolveBuilderModelProfile(
  stage: BuilderLlmPromptStage,
  configService: ConfigService,
): OllamaModelProfile {
  const sharedNumCtx = parseNumber(configService.get('OLLAMA_NUM_CTX'));

  if (stage === 'plan') {
    return {
      profileVersion: PROFILE_VERSION,
      stage,
      model: configService.get<string>(
        'BUILDER_OLLAMA_PLAN_MODEL',
        'dockus-builder-plan',
      ),
      baseModel: configService.get<string>(
        'PLAN_BASE_MODEL',
        'qwen2.5-coder:7b',
      ),
      numCtx: Math.max(sharedNumCtx ?? DEFAULT_NUM_CTX.plan, DEFAULT_NUM_CTX.plan),
      numPredict: DEFAULT_NUM_PREDICT.plan,
      temperature: DEFAULT_TEMPERATURE.plan,
      topP: DEFAULT_TOP_P.plan,
      repeatPenalty: DEFAULT_REPEAT_PENALTY.plan,
      stopTokens: DEFAULT_STOP_TOKENS,
      keepAliveSeconds: DEFAULT_KEEP_ALIVE_SECONDS,
      timeoutMs: DEFAULT_TIMEOUT_MS.plan,
    };
  }

  if (stage === 'evaluation') {
    return {
      profileVersion: PROFILE_VERSION,
      stage,
      model: configService.get<string>(
        'BUILDER_OLLAMA_EVAL_MODEL',
        'dockus-builder-eval',
      ),
      baseModel: configService.get<string>(
        'EVAL_BASE_MODEL',
        'deepseek-r1:8b',
      ),
      numCtx: Math.max(sharedNumCtx ?? DEFAULT_NUM_CTX.evaluation, DEFAULT_NUM_CTX.evaluation),
      numPredict: DEFAULT_NUM_PREDICT.evaluation,
      temperature: DEFAULT_TEMPERATURE.evaluation,
      topP: DEFAULT_TOP_P.evaluation,
      repeatPenalty: DEFAULT_REPEAT_PENALTY.evaluation,
      stopTokens: DEFAULT_STOP_TOKENS,
      keepAliveSeconds: DEFAULT_KEEP_ALIVE_SECONDS,
      timeoutMs: DEFAULT_TIMEOUT_MS.evaluation,
    };
  }

  if (stage === 'chat') {
    return {
      profileVersion: PROFILE_VERSION,
      stage,
      model: configService.get<string>(
        'BUILDER_OLLAMA_CHAT_MODEL',
        'dockus-builder-chat',
      ),
      baseModel: configService.get<string>(
        'CHAT_BASE_MODEL',
        'qwen2.5-coder:7b',
      ),
      numCtx: Math.max(sharedNumCtx ?? DEFAULT_NUM_CTX.chat, DEFAULT_NUM_CTX.chat),
      numPredict: DEFAULT_NUM_PREDICT.chat,
      temperature: DEFAULT_TEMPERATURE.chat,
      topP: DEFAULT_TOP_P.chat,
      repeatPenalty: DEFAULT_REPEAT_PENALTY.chat,
      stopTokens: DEFAULT_STOP_TOKENS,
      keepAliveSeconds: DEFAULT_KEEP_ALIVE_SECONDS,
      timeoutMs: DEFAULT_TIMEOUT_MS.chat,
    };
  }

  return {
    profileVersion: PROFILE_VERSION,
    stage,
    model: configService.get<string>(
      'BUILDER_OLLAMA_QUALITY_MODEL',
      'dockus-builder-quality',
    ),
    baseModel: configService.get<string>(
      'QUALITY_BASE_MODEL',
      'deepseek-r1:8b',
    ),
    numCtx: Math.max(sharedNumCtx ?? DEFAULT_NUM_CTX.quality, DEFAULT_NUM_CTX.quality),
    numPredict: DEFAULT_NUM_PREDICT.quality,
    temperature: DEFAULT_TEMPERATURE.quality,
    topP: DEFAULT_TOP_P.quality,
    repeatPenalty: DEFAULT_REPEAT_PENALTY.quality,
    stopTokens: DEFAULT_STOP_TOKENS,
    keepAliveSeconds: DEFAULT_KEEP_ALIVE_SECONDS,
    timeoutMs: DEFAULT_TIMEOUT_MS.quality,
  };
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
