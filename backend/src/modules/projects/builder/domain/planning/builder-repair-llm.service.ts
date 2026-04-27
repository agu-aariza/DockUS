import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  BuilderLlmAssessment,
  BuilderLlmPhaseResult,
  BuildStage,
  RuntimeFile,
  StaticFinding,
  StaticReviewIssue,
} from '../builder.types';
import { parseBuilderLlmAssessment } from '../llm/builder-llm-assessment.parser';
import {
  readTextFileSafe,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';

@Injectable()
export class BuilderRepairLlmService {
  private readonly logger = new Logger(BuilderRepairLlmService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly baseModel: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly systemPrompt: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_LLM_ASSIST_ENABLED',
        true,
      ),
    );
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.baseModel = this.configService.get<string>(
      'BUILDER_OLLAMA_MODEL',
      'qwen2.5-coder:7b',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_PLAN_MODEL',
      'dockus-builder-plan',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars =
      this.configService.get<number>('BUILDER_LLM_REPAIR_MAX_INPUT_CHARS') ??
      this.configService.get<number>(
        'BUILDER_LLM_ASSIST_MAX_INPUT_CHARS',
        15000,
      );
    const promptPath = path.resolve(
      __dirname,
      '../../../../../../scripts/repair-system-prompt.txt',
    );
    this.systemPrompt = readFileSync(promptPath, 'utf8');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async repair(input: {
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    assessment: BuilderLlmAssessment;
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    failureStage: BuildStage;
    failureReasonCode: string;
    buildLogText: string | null;
    podLogs: string | null;
    podDescribe: string | null;
    kubernetesEvents: string | null;
    priorRepairAttempts: number;
  }): Promise<BuilderLlmPhaseResult | null> {
    if (!this.enabled) {
      return null;
    }

    const { systemPrompt, userPrompt } = await this.buildPrompts(input);
    const { response, model } = await this.callModel(systemPrompt, userPrompt);

    return {
      model,
      assessment: this.parseResponse(response),
    };
  }

  private async buildPrompts(input: {
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    assessment: BuilderLlmAssessment;
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    failureStage: BuildStage;
    failureReasonCode: string;
    buildLogText: string | null;
    podLogs: string | null;
    podDescribe: string | null;
    kubernetesEvents: string | null;
    priorRepairAttempts: number;
  }): Promise<{ systemPrompt: string; userPrompt: string }> {
    const snippets = await this.collectSnippets(input.runtimeFiles);
    const payload = JSON.stringify(
      {
        currentAssessment: input.assessment,
        failure: {
          stage: input.failureStage,
          reasonCode: input.failureReasonCode,
          priorRepairAttempts: input.priorRepairAttempts,
          buildLogText: input.buildLogText?.slice(-6000) ?? null,
          podLogs: input.podLogs?.slice(-6000) ?? null,
          podDescribe: input.podDescribe?.slice(-6000) ?? null,
          kubernetesEvents: input.kubernetesEvents?.slice(-6000) ?? null,
        },
        staticFindings: input.staticFindings.slice(0, 20),
        staticReviewIssues: input.staticReviewIssues.slice(0, 30),
        snippets,
      },
      null,
      2,
    ).slice(0, this.maxInputChars);

    return {
      systemPrompt: this.systemPrompt,
      userPrompt: `Entrada de self-healing:\n${payload}`,
    };
  }

  private async collectSnippets(
    runtimeFiles: RuntimeFile[],
  ): Promise<Array<{ path: string; content: string }>> {
    const prioritized = [...runtimeFiles]
      .filter(
        (file) =>
          file.relativePath.endsWith('.py') ||
          file.relativePath.endsWith('.txt') ||
          file.relativePath.endsWith('.toml'),
      )
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .slice(0, 10);

    const snippets: Array<{ path: string; content: string }> = [];
    for (const file of prioritized) {
      const content = await readTextFileSafe(file.absolutePath);
      if (!content.trim()) {
        continue;
      }
      snippets.push({
        path: toPosixPath(file.relativePath),
        content: content.slice(0, 1800),
      });
    }

    return snippets;
  }

  private async callModel(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ response: string; model: string }> {
    try {
      const response = await this.callSpecificModel(this.model, userPrompt);
      return { response, model: this.model };
    } catch (error) {
      if (this.model === this.baseModel) {
        throw error;
      }
      this.logger.warn(
        `Falló el modelo repair ${this.model}; se usará fallback ${this.baseModel}: ${error instanceof Error ? error.message : 'error no tipado'}`,
      );
      const response = await this.callSpecificModel(
        this.baseModel,
        userPrompt,
        systemPrompt,
      );
      return { response, model: this.baseModel };
    }
  }

  private async callSpecificModel(
    model: string,
    prompt: string,
    system?: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream: false,
          prompt,
          ...(system && { system }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama devolvió ${response.status}: ${(await response.text()).slice(0, 250)}`,
        );
      }

      const payload = (await response.json()) as { response?: unknown };
      if (typeof payload.response !== 'string') {
        throw new Error('Respuesta de repair LLM sin campo response string.');
      }

      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout agotado al reparar receta con LLM.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(raw: string): BuilderLlmAssessment {
    return parseBuilderLlmAssessment(raw, { mode: 'planning' });
  }
}
