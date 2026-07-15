/**
 * @fileoverview Adaptador para la API nativa de Anthropic (`/v1/messages`).
 *
 * @module AnthropicGenerationService
 */

import { Injectable } from '@nestjs/common';
import type { ILlmGenerationService } from '../llm-generation.token';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmUsage,
} from '../llm.types';
import { joinUrl, postJson } from '../llm-request.util';
import { HttpLlmProviderBase } from './http-llm-provider.base';

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1';
const DEFAULT_API_VERSION = '2023-06-01';

interface AnthropicMessagesResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

@Injectable()
export class AnthropicGenerationService
  extends HttpLlmProviderBase
  implements ILlmGenerationService
{
  protected readonly providerName = 'Anthropic';

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const { profile, credentials, prompt, stage } = request;
    const timeoutMs = request.timeoutMs ?? profile.timeoutMs;

    this.logStart(request, timeoutMs);

    const endpoint = this.requireEndpoint(credentials, DEFAULT_ENDPOINT);
    const body: Record<string, unknown> = {
      model: profile.modelId,
      max_tokens: profile.maxTokens,
      temperature: profile.temperature,
      top_p: profile.topP,
      messages: [{ role: 'user', content: prompt }],
    };

    const systemPrompt = this.resolveSystemPrompt(request);
    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (profile.stopSequences.length > 0) {
      body.stop_sequences = profile.stopSequences;
    }

    const raw = (await postJson(
      this.providerName,
      joinUrl(endpoint, 'messages'),
      {
        'x-api-key': this.requireApiKey(credentials),
        'anthropic-version':
          credentials?.modelVersion?.trim() || DEFAULT_API_VERSION,
      },
      body,
      timeoutMs,
    )) as AnthropicMessagesResponse;

    // La respuesta es una lista de bloques; solo los de texto nos interesan.
    const text = this.requireText(
      raw.content
        ?.filter((block) => block.type === 'text' || block.text)
        .map((block) => block.text ?? '')
        .join('')
        .trim(),
      stage,
    );

    const usage: LlmUsage = {
      inputTokens: this.toTokenCount(raw.usage?.input_tokens),
      outputTokens: this.toTokenCount(raw.usage?.output_tokens),
    };

    this.logUsage(request, usage);
    return { text, usage };
  }
}
