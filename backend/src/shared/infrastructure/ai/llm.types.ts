export type BuilderLlmPromptStage =
  'plan' | 'facts' | 'evaluation' | 'quality' | 'chat';

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

/**
 * Consumo de tokens declarado por el proveedor. Es la única vía para medir el
 * coste de una evaluación: el precio de Bedrock se factura por token de entrada
 * y de salida.
 */
export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmGenerateResult {
  text: string;
  usage: LlmUsage;
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
