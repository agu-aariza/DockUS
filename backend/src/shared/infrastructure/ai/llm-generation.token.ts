import type { LlmGenerateRequest, LlmGenerateResult } from './llm.types';

export interface ILlmGenerationService {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
}
