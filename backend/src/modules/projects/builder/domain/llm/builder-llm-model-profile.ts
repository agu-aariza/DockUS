import { ConfigService } from '@nestjs/config';
import type {
  BuilderLlmPromptStage,
  LlmModelProfile,
} from '../../../../../shared/infrastructure/ai/llm.types';

const PROFILE_VERSION = 'builder-bedrock-profile/v1';
const DEFAULT_MODEL_ID = 'us.qwen.qwen3-coder-480b-a35b-v1:0';

const DEFAULT_MAX_TOKENS: Record<BuilderLlmPromptStage, number> = {
  plan: 4096,
  evaluation: 8192,
  quality: 8192,
  chat: 8192,
};

const DEFAULT_TEMPERATURE: Record<BuilderLlmPromptStage, number> = {
  plan: 0.1,
  evaluation: 0.2,
  quality: 0.3,
  chat: 0.5,
};

const DEFAULT_TOP_P = 0.9;

const DEFAULT_TIMEOUT_MS: Record<BuilderLlmPromptStage, number> = {
  plan: 120_000,
  evaluation: 300_000,
  quality: 300_000,
  chat: 300_000,
};

export function resolveBuilderModelProfile(
  stage: BuilderLlmPromptStage,
  configService: ConfigService,
): LlmModelProfile {
  const envKey = `BUILDER_BEDROCK_${stage.toUpperCase()}_MODEL_ID`;
  const modelId = configService.get<string>(envKey) ?? DEFAULT_MODEL_ID;

  return {
    profileVersion: PROFILE_VERSION,
    stage,
    modelId,
    maxTokens: DEFAULT_MAX_TOKENS[stage],
    temperature: DEFAULT_TEMPERATURE[stage],
    topP: DEFAULT_TOP_P,
    stopSequences: [],
    timeoutMs: DEFAULT_TIMEOUT_MS[stage],
  };
}
