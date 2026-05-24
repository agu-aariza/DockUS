export type BuilderLlmPromptStage = 'plan' | 'evaluation' | 'quality' | 'chat';

export interface LlmModelProfile {
  profileVersion: string;
  stage: BuilderLlmPromptStage;
  modelId: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stopSequences: string[];
  timeoutMs: number;
}

export interface LlmGenerateRequest {
  stage: BuilderLlmPromptStage;
  prompt: string;
  systemPrompt: string | null;
  profile: LlmModelProfile;
  promptId: string;
  timeoutMs?: number;
  format?: 'json';
}
