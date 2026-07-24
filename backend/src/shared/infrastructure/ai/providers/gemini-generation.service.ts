/**
 * @fileoverview Adaptador para la API de Google Gemini (`:generateContent`).
 *
 * @module GeminiGenerationService
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

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiGenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

@Injectable()
export class GeminiGenerationService
  extends HttpLlmProviderBase
  implements ILlmGenerationService
{
  protected readonly providerName = 'Google Gemini';

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const { profile, credentials, prompt, stage } = request;
    const timeoutMs = request.timeoutMs ?? profile.timeoutMs;

    this.logStart(request, timeoutMs);

    const endpoint = this.requireEndpoint(credentials, DEFAULT_ENDPOINT);
    const apiKey = this.requireApiKey(credentials);

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: profile.maxTokens,
      temperature: profile.temperature,
      topP: profile.topP,
    };
    if (profile.stopSequences.length > 0) {
      generationConfig.stopSequences = profile.stopSequences;
    }
    if (request.format === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    };

    const systemPrompt = this.resolveSystemPrompt(request);
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    // La clave viaja en cabecera, no en query string: una URL acaba en los logs
    // de acceso de cualquier intermediario y en el campo `http.url` que las
    // herramientas de trazado capturan por defecto. `x-goog-api-key` es la
    // alternativa soportada por la API de Gemini.
    const url = joinUrl(
      endpoint,
      `models/${encodeURIComponent(profile.modelId)}:generateContent`,
    );

    const raw = (await postJson(
      this.providerName,
      url,
      { 'x-goog-api-key': apiKey },
      body,
      timeoutMs,
    )) as GeminiGenerateContentResponse;

    const text = this.requireText(
      raw.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim(),
      stage,
    );

    const usage: LlmUsage = {
      inputTokens: this.toTokenCount(raw.usageMetadata?.promptTokenCount),
      outputTokens: this.toTokenCount(raw.usageMetadata?.candidatesTokenCount),
    };

    this.logUsage(request, usage);
    return { text, usage };
  }
}
