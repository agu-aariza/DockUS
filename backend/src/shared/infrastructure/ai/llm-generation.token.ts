import type { LlmGenerateRequest } from './llm.types';

export const LLM_GENERATION_SERVICE = Symbol('LLM_GENERATION_SERVICE');

export abstract class ILlmGenerationService {
  abstract generate(request: LlmGenerateRequest): Promise<string>;
}
