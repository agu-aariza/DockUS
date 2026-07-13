import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ConfiguredRetryStrategy } from '@smithy/util-retry';
import type { ILlmGenerationService } from './llm-generation.token';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmUsage,
} from './llm.types';
import {
  BedrockRequestError,
  createBedrockInvalidResponseError,
  mapBedrockError,
} from './bedrock-request.util';

@Injectable()
export class BedrockGenerationService implements ILlmGenerationService {
  private readonly logger = new Logger(BedrockGenerationService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const maxAttempts = this.configService.get<number>(
      'BUILDER_BEDROCK_MAX_ATTEMPTS',
      3,
    );
    const retryBaseDelayMs = this.configService.get<number>(
      'BUILDER_BEDROCK_RETRY_BASE_DELAY_MS',
      250,
    );

    this.client = new BedrockRuntimeClient({
      region: this.region,
      retryStrategy: new ConfiguredRetryStrategy(
        maxAttempts,
        (attempt) => retryBaseDelayMs * 2 ** attempt,
      ),
    });
  }

  getRuntimeConfig(): { region: string } {
    return { region: this.region };
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const { profile, prompt, systemPrompt, stage, promptId } = request;
    const timeoutMs = request.timeoutMs ?? profile.timeoutMs;

    const effectiveSystem =
      request.format === 'json'
        ? `${systemPrompt ?? ''}\nRespond ONLY with valid JSON. No markdown fences, no explanation outside the JSON object.`.trim()
        : (systemPrompt ?? undefined);

    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_start',
        stage,
        promptId,
        modelId: profile.modelId,
        profileVersion: profile.profileVersion,
        region: this.region,
        timeoutMs,
        maxTokens: profile.maxTokens,
        temperature: profile.temperature,
      }),
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const command = new ConverseCommand({
        modelId: profile.modelId,
        system: effectiveSystem ? [{ text: effectiveSystem }] : undefined,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: {
          maxTokens: profile.maxTokens,
          temperature: profile.temperature,
          topP: profile.topP,
          stopSequences:
            profile.stopSequences.length > 0
              ? profile.stopSequences
              : undefined,
        },
      });

      const response = await this.client.send(command, {
        abortSignal: controller.signal,
      });

      const text = response.output?.message?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim() === '') {
        throw createBedrockInvalidResponseError(
          `Respuesta de Bedrock vacía para la etapa "${stage}".`,
        );
      }

      // `ConverseCommand` devuelve el consumo en la misma respuesta. Sin él, el
      // coste de una evaluación no es medible: Bedrock factura por token.
      const usage: LlmUsage = {
        inputTokens: response.usage?.inputTokens ?? null,
        outputTokens: response.usage?.outputTokens ?? null,
      };

      this.logger.log(
        JSON.stringify({
          event: 'builder_llm_stage_usage',
          stage,
          promptId,
          modelId: profile.modelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        }),
      );

      return { text, usage };
    } catch (error) {
      if (error instanceof BedrockRequestError) {
        throw error;
      }
      throw mapBedrockError(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
