import type { LlmGenerateRequest } from './llm.types';

export const LLM_GENERATION_SERVICE = Symbol('LLM_GENERATION_SERVICE');

export interface ILlmGenerationService {
  generate(request: LlmGenerateRequest): Promise<string>;
}
