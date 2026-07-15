/**
 * @fileoverview Base de los adaptadores de LLM que hablan HTTP/JSON.
 *
 * Contexto:
 * - Bedrock usa el SDK de AWS y tiene su propio servicio; el resto de
 *   proveedores (OpenAI, Azure, Anthropic, Gemini, Ollama) son llamadas HTTP.
 * - Esta clase centraliza el modo JSON, el logging de etapa y el reporte de
 *   consumo para que los adaptadores solo describan su protocolo.
 *
 * @module HttpLlmProviderBase
 */

import { Logger } from '@nestjs/common';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProviderCredentials,
  LlmUsage,
} from '../llm.types';
import {
  createLlmInvalidResponseError,
  createMissingCredentialsError,
} from '../llm-request.util';

const JSON_MODE_INSTRUCTION =
  'Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON object.';

export abstract class HttpLlmProviderBase {
  protected abstract readonly providerName: string;
  protected readonly logger = new Logger(this.constructor.name);

  abstract generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;

  /**
   * Bedrock añade la misma coletilla al system prompt cuando la etapa exige
   * JSON; replicarla aquí mantiene los contratos comparables entre proveedores.
   */
  protected resolveSystemPrompt(request: LlmGenerateRequest): string | null {
    const base = request.systemPrompt ?? '';
    if (request.format !== 'json') {
      return base.trim() === '' ? null : base;
    }
    return `${base}\n${JSON_MODE_INSTRUCTION}`.trim();
  }

  protected requireApiKey(
    credentials: LlmProviderCredentials | null | undefined,
  ): string {
    const apiKey = credentials?.apiKey?.trim();
    if (!apiKey) {
      throw createMissingCredentialsError(this.providerName, 'API key');
    }
    return apiKey;
  }

  protected requireEndpoint(
    credentials: LlmProviderCredentials | null | undefined,
    fallback?: string,
  ): string {
    const endpoint = credentials?.endpoint?.trim() || fallback;
    if (!endpoint) {
      throw createMissingCredentialsError(this.providerName, 'endpoint');
    }
    return endpoint;
  }

  protected requireText(text: unknown, stage: string): string {
    if (typeof text !== 'string' || text.trim() === '') {
      throw createLlmInvalidResponseError(
        `Respuesta vacía de ${this.providerName} para la etapa "${stage}".`,
      );
    }
    return text;
  }

  protected logStart(request: LlmGenerateRequest, timeoutMs: number): void {
    const { profile, stage, promptId } = request;
    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_start',
        stage,
        promptId,
        providerId: profile.providerId,
        modelId: profile.modelId,
        profileVersion: profile.profileVersion,
        timeoutMs,
        maxTokens: profile.maxTokens,
        temperature: profile.temperature,
      }),
    );
  }

  protected logUsage(request: LlmGenerateRequest, usage: LlmUsage): void {
    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_usage',
        stage: request.stage,
        promptId: request.promptId,
        providerId: request.profile.providerId,
        modelId: request.profile.modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }),
    );
  }

  /** Los contadores de tokens llegan como number|undefined según el proveedor. */
  protected toTokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
