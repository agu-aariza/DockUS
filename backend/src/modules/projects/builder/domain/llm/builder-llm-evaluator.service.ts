import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderLlmStageErrorInfo,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
  BuilderPlanContractV2,
  BUILDER_LLM_SCHEMA_VERSION,
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
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { parseBuilderPlanContractV2 } from './builder-plan-contract.parser';
import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';

export interface EvaluatorInput {
  projectRootDir: string;
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
  plannerAssessment?: BuilderPlanContractV2;
}

interface BuilderLlmTraceHooks {
  onBeforeCall?: (
    snapshot: BuilderLlmStagePromptSnapshot,
  ) => Promise<void> | void;
}

@Injectable()
export class BuilderLlmEvaluatorService {
  private readonly logger = new Logger(BuilderLlmEvaluatorService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly planModel: string;
  private readonly timeoutMs: number;
  private readonly planMaxInputChars: number;
  private readonly evalMaxInputChars: number;
  private readonly systemPrompt: string;
  private readonly planSystemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly logTrimmer: BuilderLogTrimmer,
  ) {
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://ollama:11434',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_EVAL_MODEL',
      'dockus-builder-eval',
    );
    this.planModel = this.configService.get<string>(
      'BUILDER_OLLAMA_PLAN_MODEL',
      'dockus-builder-plan',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.planMaxInputChars = this.configService.get<number>(
      'BUILDER_LLM_PLAN_MAX_INPUT_CHARS',
      15000,
    );
    this.evalMaxInputChars = this.configService.get<number>(
      'BUILDER_LLM_EVAL_MAX_INPUT_CHARS',
      15000,
    );
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.EVAL);
    this.planSystemPrompt = this.promptRegistry.getPrompt(PromptId.PLAN);
  }

  async evaluate(input: EvaluatorInput): Promise<BuilderEvaluationContractV2> {
    const trace = await this.evaluateWithTrace(input);
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    throw new Error(
      trace.error?.message ??
        'No se pudo obtener una evaluación válida del LLM.',
    );
  }

  async evaluateWithTrace(
    input: EvaluatorInput,
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<BuilderEvaluationContractV2>> {
    this.logStageStart('evaluation', this.model);

    const userPrompt = this.truncatePrompt(
      `
Instrucciones de la rúbrica:
${input.assignmentContext.rubricInstructions}

Salida esperada (Oráculo):
${input.assignmentContext.expectedOutput || 'No se ha definido una salida exacta esperada.'}

Hipótesis del planner:
${input.plannerAssessment ? JSON.stringify(input.plannerAssessment, null, 2) : 'No disponible.'}

Código fuente del alumno:
${input.sourceCodePayload}

Resultado de la ejecución de los tests del profesor (Logs):
${this.logTrimmer.smartTrim(input.executionLogs) || 'No hay logs o no se ejecutaron tests.'}
`,
      this.evalMaxInputChars,
    );

    const snapshot = this.createPromptSnapshot(
      'evaluation',
      this.model,
      userPrompt,
      this.systemPrompt,
    );
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
      this.logStageError('evaluation', this.model, serializedError);
      return this.buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderEvaluationContractV2(response);
      return this.buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError) {
      const serializedError = this.serializeError(
        parseError,
        'invalid_contract',
      );
      this.logStageError('evaluation', this.model, serializedError);
      this.logger.error(
        `Fallo al parsear respuesta del Evaluador. Respuesta bruta: ${response}`,
      );
      return this.buildTrace(snapshot, response, serializedError);
    }
  }

  async plan(input: {
    sourceCodePayload: string;
    assignmentContext: AssignmentContext;
  }): Promise<BuilderPlanContractV2> {
    const trace = await this.planWithTrace(input);
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    throw new Error(
      trace.error?.message ?? 'No se pudo obtener un plan válido del LLM.',
    );
  }

  async planWithTrace(
    input: {
      sourceCodePayload: string;
      assignmentContext: AssignmentContext;
    },
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<BuilderPlanContractV2>> {
    this.logStageStart('plan', this.planModel);

    const userPrompt = this.truncatePrompt(
      `
EXPECTATIVAS DEL PROFESOR:
Tipo de proyecto esperado: ${input.assignmentContext.expectedType}

Salida esperada (Oráculo):
${input.assignmentContext.expectedOutput || 'No se ha definido una salida exacta esperada.'}

Instrucciones de rúbrica: ${input.assignmentContext.rubricInstructions}

WORKSPACE DEL ALUMNO (ARCHIVOS):
${input.sourceCodePayload}
`,
      this.planMaxInputChars,
    );

    const snapshot = this.createPromptSnapshot(
      'plan',
      this.planModel,
      userPrompt,
      this.planSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null = null;

    try {
      response = await this.callSpecificModel(
        this.planModel,
        userPrompt,
        this.planSystemPrompt,
      );
    } catch (error: unknown) {
      const serializedError = this.serializeError(error);
      this.logStageError('plan', this.planModel, serializedError);
      return this.buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderPlanContractV2(response);
      return this.buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError) {
      const serializedError = this.serializeError(
        parseError,
        'invalid_contract',
      );
      this.logStageError('plan', this.planModel, serializedError);
      this.logger.error(
        `Fallo al parsear respuesta del Planner. Respuesta bruta: ${response}`,
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
          'Respuesta de evaluación LLM sin campo response string.',
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof OllamaRequestError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw createOllamaTimeoutError(this.baseUrl, 'evaluar builder');
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
    stage: BuilderLlmStagePromptSnapshot['stage'],
    model: string,
    prompt: string,
    systemPrompt: string | null,
  ): BuilderLlmStagePromptSnapshot {
    return {
      stage,
      model,
      systemPrompt,
      prompt,
      createdAt: new Date().toISOString(),
    };
  }

  private logStageStart(stage: 'plan' | 'evaluation', model: string): void {
    this.logger.log(
      JSON.stringify({
        event: 'builder_llm_stage_start',
        stage,
        model,
        baseUrl: this.baseUrl,
        timeoutMs: this.timeoutMs,
      }),
    );
  }

  private logStageError(
    stage: 'plan' | 'evaluation',
    model: string,
    error: BuilderLlmStageErrorInfo,
  ): void {
    this.logger.error(
      JSON.stringify({
        event: 'builder_llm_stage_error',
        stage,
        model,
        baseUrl: this.baseUrl,
        code: error.code ?? 'unknown',
        httpStatus: error.httpStatus ?? null,
        message: error.message,
      }),
    );
  }

  private buildTrace<
    TContract extends BuilderPlanContractV2 | BuilderEvaluationContractV2,
  >(
    snapshot: BuilderLlmStagePromptSnapshot,
    rawResponse: string | null,
    error: BuilderLlmStageErrorInfo | null,
    parsedContract: TContract | null = null,
  ): BuilderLlmStageTrace<TContract> {
    return {
      schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
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
      name: 'UnknownError',
      code: fallbackCode ?? 'unknown',
      message: String(error),
      httpStatus: null,
      stack: null,
      timestamp: new Date().toISOString(),
    };
  }
}
