import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOllamaConnectivityError,
  createOllamaHttpError,
  createOllamaInvalidResponseError,
  createOllamaTimeoutError,
  OllamaRequestError,
} from './ollama-request.util';

export type BuilderLlmPromptStage = 'plan' | 'evaluation' | 'quality' | 'chat';

export interface OllamaModelProfile {
  profileVersion: string;
  stage: BuilderLlmPromptStage;
  model: string;
  baseModel: string;
  numCtx: number;
  numPredict: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  stopTokens: string[];
  keepAliveSeconds: number;
  timeoutMs?: number;
}

export interface OllamaGenerateRequest {
  stage: BuilderLlmPromptStage;
  prompt: string;
  systemPrompt: string | null;
  profile: OllamaModelProfile;
  promptId: string;
  timeoutMs?: number;
  format?: 'json';
}

@Injectable()
export class OllamaGenerationService {
  private readonly logger = new Logger(OllamaGenerationService.name);
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://ollama:11434',
    );
    this.defaultTimeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
  }

  getRuntimeConfig(): { baseUrl: string; timeoutMs: number } {
    return {
      baseUrl: this.baseUrl,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  async generate(request: OllamaGenerateRequest): Promise<string> {
    const timeoutMs =
      request.timeoutMs ?? request.profile.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_start',
        stage: request.stage,
        promptId: request.promptId,
        model: request.profile.model,
        baseModel: request.profile.baseModel,
        profileVersion: request.profile.profileVersion,
        baseUrl: this.baseUrl,
        timeoutMs,
        numCtx: request.profile.numCtx,
        temperature: request.profile.temperature,
      }),
    );

    const requestFormat = request.format ?? (request.stage === 'chat' ? undefined : 'json');

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.profile.model,
          stream: false,
          ...(requestFormat ? { format: requestFormat } : {}),
          prompt: request.prompt,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          keep_alive: request.profile.keepAliveSeconds,
          options: {
            num_ctx: request.profile.numCtx,
            num_predict: request.profile.numPredict,
            temperature: request.profile.temperature,
            top_p: request.profile.topP,
            repeat_penalty: request.profile.repeatPenalty,
            stop: request.profile.stopTokens,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text();
        throw createOllamaHttpError({
          baseUrl: this.baseUrl,
          target: request.profile.model,
          status: response.status,
          details,
        });
      }

      const payload = (await response.json()) as { response?: unknown };
      if (typeof payload.response !== 'string') {
        throw createOllamaInvalidResponseError(
          `Respuesta de ${request.stage} sin campo response string.`,
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof OllamaRequestError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw createOllamaTimeoutError(
          this.baseUrl,
          `ejecutar ${request.stage} con Ollama`,
        );
      }
      throw createOllamaConnectivityError(this.baseUrl, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
