import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderLlmStageErrorInfo,
} from '../builder.types';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import {
  createOllamaConnectivityError,
  createOllamaHttpError,
  createOllamaInvalidResponseError,
  createOllamaTimeoutError,
  OllamaRequestError,
} from '../../../../../shared/infrastructure/ai/ollama-request.util';
import { parseBuilderCodeQualityContractV2 } from './builder-code-quality-contract.parser';

export interface CodeQualityInput {
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
  assessment: BuilderEvaluationContractV2;
}

export interface BuilderCodeQualityPromptSnapshot {
  model: string;
  systemPrompt: string | null;
  prompt: string;
  createdAt: string;
}

export interface BuilderCodeQualityTrace {
  model: string;
  systemPrompt: string | null;
  prompt: string;
  rawResponse: string | null;
  parsedContract: BuilderCodeQualityContractV2 | null;
  error: BuilderLlmStageErrorInfo | null;
  createdAt: string;
}

interface BuilderCodeQualityTraceHooks {
  onBeforeCall?: (
    snapshot: BuilderCodeQualityPromptSnapshot,
  ) => Promise<void> | void;
}

@Injectable()
export class BuilderCodeQualityService {
  private readonly logger = new Logger(BuilderCodeQualityService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://ollama:11434',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_QUALITY_MODEL',
      'dockus-builder-quality',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_QUALITY_MAX_INPUT_CHARS',
      20000,
    );
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.TECHNICAL_FEEDBACK);
  }

  async analyze(input: CodeQualityInput): Promise<BuilderCodeQualityContractV2> {
    const trace = await this.analyzeWithTrace(input);
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    return {
      thought: `Error analizando calidad: ${trace.error?.message ?? 'sin detalle adicional'}`,
      security: [],
      architecture: [],
      quality: [],
      rubricCompliance: [],
    };
  }

  async analyzeWithTrace(
    input: CodeQualityInput,
    hooks?: BuilderCodeQualityTraceHooks,
  ): Promise<BuilderCodeQualityTrace> {
    this.logStageStart();

    const userPrompt = this.truncatePrompt(
      `
Tipo de proyecto esperado:
${input.assignmentContext.expectedType ?? 'No especificado.'}

Instrucciones de la rúbrica:
${input.assignmentContext.rubricInstructions ?? 'No hay instrucciones adicionales.'}

Evaluación académica actual:
${JSON.stringify(input.assessment, null, 2)}

Código fuente del alumno:
${input.sourceCodePayload}

Logs de ejecución/tests:
${input.executionLogs || 'No hay logs adicionales.'}
`,
      this.maxInputChars,
    );

    const snapshot = this.createPromptSnapshot(userPrompt);
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null = null;

    try {
      response = await this.callSpecificModel(
        this.model,
        userPrompt,
        this.systemPrompt,
      );
    } catch (error: unknown) {
      const serializedError = this.serializeError(error);
      this.logStageError(serializedError);
      return this.buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderCodeQualityContractV2(response);
      return this.buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError: unknown) {
      const serializedError = this.serializeError(
        parseError,
        'invalid_contract',
      );
      this.logStageError(serializedError);
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      this.logger.error(
        `Fallo al parsear respuesta de calidad. Respuesta bruta: ${response}. Error: ${message}`,
      );
      return this.buildTrace(snapshot, response, serializedError);
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
          keep_alive: 300,
          options: {
            num_ctx: 32768,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text();
        throw createOllamaHttpError({
          baseUrl: this.baseUrl,
          target: model,
          status: response.status,
          details,
        });
      }

      const payload = (await response.json()) as { response?: unknown };
      if (typeof payload.response !== 'string') {
        throw createOllamaInvalidResponseError(
          'Respuesta de calidad LLM sin campo response string.',
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
          'analizar calidad con LLM',
        );
      }
      throw createOllamaConnectivityError(this.baseUrl, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private truncatePrompt(prompt: string, maxChars: number): string {
    if (!prompt || prompt.length <= maxChars) {
      return prompt;
    }

    const suffix = '\n...[truncated]';
    const targetLength = Math.max(0, maxChars - suffix.length);
    return `${prompt.slice(0, targetLength)}${suffix}`;
  }

  private createPromptSnapshot(
    prompt: string,
  ): BuilderCodeQualityPromptSnapshot {
    return {
      model: this.model,
      systemPrompt: this.systemPrompt,
      prompt,
      createdAt: new Date().toISOString(),
    };
  }

  private logStageStart(): void {
    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_start',
        stage: 'quality',
        model: this.model,
        baseUrl: this.baseUrl,
        timeoutMs: this.timeoutMs,
      }),
    );
  }

  private logStageError(error: BuilderLlmStageErrorInfo): void {
    this.logger.error(
      JSON.stringify({
        event: 'builder_llm_stage_error',
        stage: 'quality',
        model: this.model,
        baseUrl: this.baseUrl,
        code: error.code ?? 'unknown',
        httpStatus: error.httpStatus ?? null,
        message: error.message,
      }),
    );
  }

  private buildTrace(
    snapshot: BuilderCodeQualityPromptSnapshot,
    rawResponse: string | null,
    error: BuilderLlmStageErrorInfo | null,
    parsedContract: BuilderCodeQualityContractV2 | null = null,
  ): BuilderCodeQualityTrace {
    return {
      ...snapshot,
      rawResponse,
      parsedContract,
      error,
    };
  }

  private serializeError(
    error: unknown,
    fallbackCode?: string,
  ): BuilderLlmStageErrorInfo {
    if (error instanceof OllamaRequestError) {
      return {
        name: error.name,
        code: error.code,
        message: error.message,
        httpStatus: error.httpStatus,
        stack: error.stack ?? null,
        timestamp: new Date().toISOString(),
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        code: fallbackCode,
        message: error.message,
        httpStatus: null,
        stack: error.stack ?? null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: 'Error',
      code: fallbackCode ?? 'unknown',
      message: String(error),
      httpStatus: null,
      stack: null,
      timestamp: new Date().toISOString(),
    };
  }
}
