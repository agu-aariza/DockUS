import type { LlmGenerateRequest } from './llm.types';

export interface ILlmGenerationService {
  generate(request: LlmGenerateRequest): Promise<string>;
}
