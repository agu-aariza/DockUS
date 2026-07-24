/**
 * @fileoverview Infraestructura de clientes y despacho de LLMs (llm-generation.token).
 *
 * @module llm-generation.token
 */

import type { LlmGenerateRequest, LlmGenerateResult } from './llm.types';

export interface ILlmGenerationService {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
}
