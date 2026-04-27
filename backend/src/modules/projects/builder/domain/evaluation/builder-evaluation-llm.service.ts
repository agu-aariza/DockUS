import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as path from 'path';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  BuilderLlmAssessment,
  BuilderLlmPhaseResult,
  ExecutionContext,
  StageResult,
  StaticFinding,
  StaticReviewIssue,
  AssignmentContext,
} from '../builder.types';
import { parseBuilderLlmAssessment } from '../llm/builder-llm-assessment.parser';

@Injectable()
export class BuilderEvaluationLlmService {
  private readonly logger = new Logger(BuilderEvaluationLlmService.name);
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
      'BUILDER_OLLAMA_EVAL_MODEL',
      'dockus-builder-eval',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_EVAL_MAX_INPUT_CHARS',
      this.configService.get<number>(
        'BUILDER_LLM_ASSIST_MAX_INPUT_CHARS',
        15000,
      ),
    );
    const promptPath = path.resolve(
      __dirname,
      '../../../../../../scripts/eval-system-prompt.txt',
    );
    this.systemPrompt = readFileSync(promptPath, 'utf-8');
  }

  isEnabled(): boolean {
    return this.enabled;
  }
  async evaluate(input: {
    planningAssessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    warnings: string[];
    executionContext: ExecutionContext;
    evidenceArtifacts: Array<{ id: string; type: string }>;
    observedEvidence: unknown;
    assignmentContext: AssignmentContext;
  }): Promise<BuilderLlmPhaseResult | null> {
    if (!this.enabled) {
      return null;
    }

    const { systemPrompt, userPrompt } = this.buildPrompts(input);
    const { response, model } = await this.callModel(systemPrompt, userPrompt);
    return {
      model,
      assessment: this.parseResponse(response),
    };
  }
  private buildPrompts(input: {
    planningAssessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    staticReviewIssues: StaticReviewIssue[];
    warnings: string[];
    executionContext: ExecutionContext;
    evidenceArtifacts: Array<{ id: string; type: string }>;
    observedEvidence: unknown;
    assignmentContext: AssignmentContext;
  }): { systemPrompt: string; userPrompt: string } {
    const payload = JSON.stringify(
      {
        planningAssessment: input.planningAssessment,
        stageResults: input.stageResults,
        staticFindings: input.staticFindings.slice(0, 25),
        staticReviewIssues: input.staticReviewIssues.slice(0, 40),
        warnings: input.warnings.slice(0, 30),
        executionContext: input.executionContext,
        evidenceArtifacts: input.evidenceArtifacts
          .slice(0, 50)
          .map((artifact) => ({
            id: artifact.id,
            type: artifact.type,
          })),
        observedEvidence: input.observedEvidence,
        assignmentContext: input.assignmentContext,
      },
      null,
      2,
    ).slice(0, this.maxInputChars);

    const userPrompt = ['Entrada de evaluación:', payload].join('\n');

    return { systemPrompt: this.systemPrompt, userPrompt };
  }

  private async callModel(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ response: string; model: string }> {
    try {
      const response = await this.callSpecificModel(this.model, userPrompt);
      return {
        response,
        model: this.model,
      };
    } catch (error) {
      if (this.model === this.baseModel) {
        throw error;
      }
      this.logger.warn(
        `Falló el modelo evaluador ${this.model}; se usará fallback ${this.baseModel}: ${error instanceof Error ? error.message : 'error no tipado'}`,
      );
      const response = await this.callSpecificModel(
        this.baseModel,
        userPrompt,
        systemPrompt,
      );
      return {
        response,
        model: this.baseModel,
      };
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
        const details = await response.text();
        throw new Error(
          `Ollama devolvió ${response.status}: ${details.slice(0, 250)}`,
        );
      }

      const payload = (await response.json()) as { response?: unknown };
      if (typeof payload.response !== 'string') {
        throw new Error(
          'Respuesta de evaluación LLM sin campo response string.',
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout agotado al evaluar builder con LLM.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(raw: string): BuilderLlmPhaseResult['assessment'] {
    return parseBuilderLlmAssessment(raw, { mode: 'evaluation' });
  }
}
