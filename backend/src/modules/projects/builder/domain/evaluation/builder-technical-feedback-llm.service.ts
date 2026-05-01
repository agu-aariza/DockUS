import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BuilderTechnicalFeedback,
  RuntimeFile,
  StageResult,
  StaticFinding,
  StaticReviewIssue,
  TECHNICAL_FEEDBACK_AXES,
  TECHNICAL_FEEDBACK_SEVERITIES,
  TechnicalFeedbackItem,
  AssignmentContext,
} from '../builder.types';
import {
  readTextFileSafe,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../shared/infrastructure/ai/prompt-registry.service';

@Injectable()
export class BuilderTechnicalFeedbackLlmService {
  private readonly logger = new Logger(BuilderTechnicalFeedbackLlmService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly baseModel: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
  ) {
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
      'BUILDER_OLLAMA_EVAL_MODEL',
      'dockus-builder-eval',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars =
      this.configService.get<number>('BUILDER_LLM_FEEDBACK_MAX_INPUT_CHARS') ??
      this.configService.get<number>(
        'BUILDER_LLM_ASSIST_MAX_INPUT_CHARS',
        15000,
      );
    this.systemPrompt = this.promptRegistry.getPrompt(
      PromptId.TECHNICAL_FEEDBACK,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(input: {
    assessment: unknown;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    warnings: string[];
    runtimeFiles: RuntimeFile[];
    assignmentContext: AssignmentContext;
  }): Promise<BuilderTechnicalFeedback> {
    if (!this.enabled) {
      return this.emptyFeedback();
    }

    const { systemPrompt, userPrompt } = await this.buildPrompts(input);
    const response = await this.callModel(systemPrompt, userPrompt);
    return this.parseResponse(response);
  }

  private async buildPrompts(input: {
    assessment: unknown;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    warnings: string[];
    runtimeFiles: RuntimeFile[];
    assignmentContext: AssignmentContext;
  }): Promise<{ systemPrompt: string; userPrompt: string }> {
    const snippets = await this.collectSnippets(input.runtimeFiles);
    const payload = JSON.stringify(
      {
        assessment: input.assessment,
        stageResults: input.stageResults,
        staticFindings: input.staticFindings.slice(0, 25),
        staticReviewIssues: input.staticReviewIssues.slice(0, 40),
        warnings: input.warnings.slice(0, 20),
        snippets,
        assignmentContext: input.assignmentContext,
      },
      null,
      2,
    ).slice(0, this.maxInputChars);

    return {
      systemPrompt: this.systemPrompt,
      userPrompt: `Entrada de feedback técnico:\n${payload}`,
    };
  }

  private async collectSnippets(
    runtimeFiles: RuntimeFile[],
  ): Promise<Array<{ path: string; content: string }>> {
    const prioritized = [...runtimeFiles]
      .filter((file) => file.relativePath.endsWith('.py'))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .slice(0, 8);

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
  ): Promise<string> {
    try {
      return await this.callSpecificModel(this.model, userPrompt);
    } catch (error) {
      if (this.model === this.baseModel) {
        throw error;
      }
      this.logger.warn(
        `Falló el modelo de feedback ${this.model}; se usará fallback ${this.baseModel}: ${error instanceof Error ? error.message : 'error no tipado'}`,
      );
      return this.callSpecificModel(this.baseModel, userPrompt, systemPrompt);
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
        throw new Error(
          'Respuesta de feedback técnico sin campo response string.',
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout agotado al generar feedback técnico.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(raw: string): BuilderTechnicalFeedback {
    const normalized = raw
      .trim()
      .replace(/^```(?:json)?/u, '')
      .replace(/```$/u, '')
      .trim();
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    const feedback = this.emptyFeedback();

    for (const axis of TECHNICAL_FEEDBACK_AXES) {
      const entries = parsed[axis];
      if (!Array.isArray(entries)) {
        continue;
      }
      feedback[axis] = entries
        .map((entry) => this.normalizeItem(entry))
        .filter((entry): entry is TechnicalFeedbackItem => entry !== null);
    }

    return feedback;
  }

  private normalizeItem(entry: unknown): TechnicalFeedbackItem | null {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }

    const item = entry as Record<string, unknown>;
    const severity =
      typeof item.severity === 'string' &&
      TECHNICAL_FEEDBACK_SEVERITIES.includes(
        item.severity as (typeof TECHNICAL_FEEDBACK_SEVERITIES)[number],
      )
        ? (item.severity as TechnicalFeedbackItem['severity'])
        : 'medium';

    return {
      title:
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim()
          : 'Hallazgo técnico',
      detail:
        typeof item.detail === 'string' && item.detail.trim()
          ? item.detail.trim()
          : 'Sin detalle adicional.',
      severity,
      file:
        typeof item.file === 'string' && item.file.trim()
          ? item.file.trim()
          : null,
      line:
        typeof item.line === 'number' && Number.isFinite(item.line)
          ? Math.trunc(item.line)
          : null,
    };
  }

  private emptyFeedback(): BuilderTechnicalFeedback {
    return {
      security: [],
      architecture: [],
      quality: [],
      rubricCompliance: [],
    };
  }
}
