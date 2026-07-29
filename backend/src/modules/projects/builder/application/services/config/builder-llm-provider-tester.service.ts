/**
 * @fileoverview Prueba de conexión real contra un proveedor configurado.
 *
 * Envía un prompt mínimo con el modelo y las credenciales guardadas y devuelve
 * lo que responda el proveedor. No simula nada: si la clave es inválida o el
 * endpoint no existe, el resultado es un fallo con el error del proveedor.
 *
 * @module BuilderLlmProviderTester
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ILlmGenerationService } from '../../../../../../shared/infrastructure/ai/llm-generation.token';
import { LLM_GENERATION_SERVICE } from '../../../../../../shared/infrastructure/ai/llm-generation.token';
import { LlmRequestError } from '../../../../../../shared/infrastructure/ai/llm-request.util';
import type { LlmProviderId } from '../../../../../../shared/infrastructure/ai/llm.types';
import { BuilderLlmConfigService } from './builder-llm-config.service';

const TEST_PROMPT =
  'Responde únicamente con la palabra OK para confirmar la conexión.';
const TEST_MAX_TOKENS = 16;
const TEST_TIMEOUT_MS = 30_000;

export interface LlmProviderTestResult {
  ok: boolean;
  providerId: LlmProviderId;
  modelId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responsePreview: string | null;
  errorCode: string | null;
  message: string;
}

@Injectable()
export class BuilderLlmProviderTester {
  private readonly logger = new Logger(BuilderLlmProviderTester.name);

  constructor(
    private readonly llmConfigService: BuilderLlmConfigService,
    @Inject(LLM_GENERATION_SERVICE)
    private readonly llmRouter: ILlmGenerationService,
  ) {}

  async test(providerId: LlmProviderId): Promise<LlmProviderTestResult> {
    const stored = await this.llmConfigService.getCredentials(providerId);
    if (!stored) {
      throw new NotFoundException(
        `El proveedor "${providerId}" no está configurado. Guarda la configuración antes de probarla.`,
      );
    }

    const { config, credentials } = stored;
    const startedAt = Date.now();

    try {
      const { text, usage } = await this.llmRouter.generate({
        stage: 'chat',
        promptId: 'connection-test',
        prompt: TEST_PROMPT,
        systemPrompt: null,
        credentials,
        profile: {
          profileVersion: 'connection-test/v1',
          stage: 'chat',
          providerId,
          modelId: config.modelId,
          maxTokens: TEST_MAX_TOKENS,
          temperature: 0,
          topP: 1,
          stopSequences: [],
          timeoutMs: TEST_TIMEOUT_MS,
        },
      });

      return {
        ok: true,
        providerId,
        modelId: config.modelId,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        responsePreview: text.slice(0, 200),
        errorCode: null,
        message: 'El proveedor ha respondido correctamente.',
      };
    } catch (error) {
      const isLlmError = error instanceof LlmRequestError;
      const message = error instanceof Error ? error.message : String(error);

      // Un fallo de conexión es un resultado válido de la prueba, no un 500.
      this.logger.warn(
        `Prueba de conexión fallida para "${providerId}": ${message}`,
      );

      return {
        ok: false,
        providerId,
        modelId: config.modelId,
        latencyMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        responsePreview: null,
        errorCode: isLlmError ? error.code : 'unknown',
        message,
      };
    }
  }
}
