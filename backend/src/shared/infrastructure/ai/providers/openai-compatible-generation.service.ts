/**
 * @fileoverview Adaptador para proveedores con la API de chat de OpenAI.
 *
 * Cubre tres proveedores que hablan el mismo protocolo con rutas y cabeceras
 * distintas: OpenAI nativo, Azure OpenAI (deployments + `api-version`) y Ollama
 * (endpoint local, sin clave).
 *
 * @module OpenAiCompatibleGenerationService
 */

import { Injectable } from '@nestjs/common';
import type { ILlmGenerationService } from '../llm-generation.token';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProviderId,
  LlmUsage,
} from '../llm.types';
import { joinUrl, postJson } from '../llm-request.util';
import { HttpLlmProviderBase } from './http-llm-provider.base';

const DEFAULT_ENDPOINTS: Partial<Record<LlmProviderId, string>> = {
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
};

const DEFAULT_AZURE_API_VERSION = '2024-02-15-preview';

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

@Injectable()
export class OpenAiCompatibleGenerationService
  extends HttpLlmProviderBase
  implements ILlmGenerationService
{
  protected readonly providerName = 'OpenAI';

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const { profile, prompt, stage } = request;
    const providerId = profile.providerId;
    const timeoutMs = request.timeoutMs ?? profile.timeoutMs;

    this.logStart(request, timeoutMs);

    const systemPrompt = this.resolveSystemPrompt(request);
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model: profile.modelId,
      messages,
      max_tokens: profile.maxTokens,
      temperature: profile.temperature,
      top_p: profile.topP,
    };
    if (profile.stopSequences.length > 0) {
      body.stop = profile.stopSequences;
    }
    if (request.format === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const { url, headers } = this.resolveTarget(providerId, request);
    const raw = (await postJson(
      this.displayName(providerId),
      url,
      headers,
      body,
      timeoutMs,
    )) as OpenAiChatResponse;

    const text = this.requireText(raw.choices?.[0]?.message?.content, stage);
    const usage: LlmUsage = {
      inputTokens: this.toTokenCount(raw.usage?.prompt_tokens),
      outputTokens: this.toTokenCount(raw.usage?.completion_tokens),
    };

    this.logUsage(request, usage);
    return { text, usage };
  }

  private resolveTarget(
    providerId: LlmProviderId,
    request: LlmGenerateRequest,
  ): { url: string; headers: Record<string, string> } {
    const { credentials, profile } = request;

    if (providerId === 'azure') {
      // Azure enruta por deployment, no por modelo, y exige `api-version`.
      const endpoint = this.requireEndpoint(credentials);
      const apiVersion =
        credentials?.modelVersion?.trim() || DEFAULT_AZURE_API_VERSION;
      const url = `${joinUrl(
        endpoint,
        `openai/deployments/${encodeURIComponent(profile.modelId)}/chat/completions`,
      )}?api-version=${encodeURIComponent(apiVersion)}`;

      return { url, headers: { 'api-key': this.requireApiKey(credentials) } };
    }

    const endpoint = this.requireEndpoint(
      credentials,
      DEFAULT_ENDPOINTS[providerId],
    );
    const url = joinUrl(endpoint, 'chat/completions');

    // Ollama corre en local sin autenticación; exigir clave rompería el caso de uso.
    if (providerId === 'ollama') {
      return { url, headers: {} };
    }

    return {
      url,
      headers: { authorization: `Bearer ${this.requireApiKey(credentials)}` },
    };
  }

  private displayName(providerId: LlmProviderId): string {
    if (providerId === 'azure') return 'Azure OpenAI';
    if (providerId === 'ollama') return 'Ollama';
    return 'OpenAI';
  }
}
