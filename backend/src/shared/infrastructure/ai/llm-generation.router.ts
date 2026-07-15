/**
 * @fileoverview Router de generación: elige el adaptador según el proveedor.
 *
 * Contexto:
 * - Los servicios de dominio del Builder ya no dependen de Bedrock, sino de
 *   este router: el proveedor lo decide el perfil (`profile.providerId`), que a
 *   su vez sale de la configuración de la pestaña "Modelos de IA".
 * - Las credenciales llegan en la petición, nunca en el perfil: el perfil se
 *   persiste en los snapshots de prompt del `BuildRun`.
 *
 * @module LlmGenerationRouter
 */

import { Injectable } from '@nestjs/common';
import { BedrockGenerationService } from './bedrock-generation.service';
import type { ILlmGenerationService } from './llm-generation.token';
import { LlmRequestError } from './llm-request.util';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProviderId,
} from './llm.types';
import { AnthropicGenerationService } from './providers/anthropic-generation.service';
import { GeminiGenerationService } from './providers/gemini-generation.service';
import { OpenAiCompatibleGenerationService } from './providers/openai-compatible-generation.service';

@Injectable()
export class LlmGenerationRouter implements ILlmGenerationService {
  constructor(
    private readonly bedrock: BedrockGenerationService,
    private readonly openAiCompatible: OpenAiCompatibleGenerationService,
    private readonly anthropic: AnthropicGenerationService,
    private readonly gemini: GeminiGenerationService,
  ) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    return this.resolveAdapter(request.profile.providerId).generate(request);
  }

  private resolveAdapter(providerId: LlmProviderId): ILlmGenerationService {
    switch (providerId) {
      case 'bedrock':
        return this.bedrock;
      case 'openai':
      case 'azure':
      case 'ollama':
        return this.openAiCompatible;
      case 'anthropic':
        return this.anthropic;
      case 'gemini':
        return this.gemini;
      default: {
        const unsupported: never = providerId;
        throw new LlmRequestError({
          code: 'unsupported_provider',
          message: `Proveedor de LLM no soportado: "${String(unsupported)}".`,
        });
      }
    }
  }
}
