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
  OllamaGenerationService,
  OllamaModelProfile,
} from '../../../../../shared/infrastructure/ai/ollama-generation.service';
import { OllamaRequestError } from '../../../../../shared/infrastructure/ai/ollama-request.util';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';
import { resolveBuilderModelProfile } from './builder-llm-model-profile';
import { parseBuilderPlanContractV2 } from './builder-plan-contract.parser';
import {
  ComposedPromptPayload,
  composeEvaluationPrompt,
  composePlanPrompt,
} from './builder-prompt-composer';

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
  private readonly planMaxInputChars: number;
  private readonly evalMaxInputChars: number;
  private readonly systemPrompt: string;
  private readonly planSystemPrompt: string;
  private readonly evaluationProfile: OllamaModelProfile;
  private readonly planProfile: OllamaModelProfile;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly logTrimmer: BuilderLogTrimmer,
    private readonly ollamaGenerationService: OllamaGenerationService,
  ) {
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
    this.evaluationProfile = resolveBuilderModelProfile(
      'evaluation',
      this.configService,
    );
    this.planProfile = resolveBuilderModelProfile('plan', this.configService);
  }

  async evaluate(input: EvaluatorInput): Promise<BuilderEvaluationContractV2> {
    const trace = await this.evaluateWithTrace(input);
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    throw new Error(
      trace.error?.message ??
        'No se pudo obtener una evaluacion valida del LLM.',
    );
  }

  async evaluateWithTrace(
    input: EvaluatorInput,
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<BuilderEvaluationContractV2>> {
    const composedPrompt = composeEvaluationPrompt(
      input.sourceCodePayload,
      this.logTrimmer.smartTrim(input.executionLogs) ||
        'No execution logs were captured.',
      input.assignmentContext,
      input.plannerAssessment,
      this.evalMaxInputChars,
    );

    const snapshot = this.createPromptSnapshot(
      'evaluation',
      PromptId.EVAL,
      this.evaluationProfile,
      composedPrompt,
      this.systemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null = null;

    try {
      response = await this.ollamaGenerationService.generate({
        stage: 'evaluation',
        promptId: PromptId.EVAL,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile: this.evaluationProfile,
      });
    } catch (error: unknown) {
      const serializedError = this.serializeError(error);
      this.logStageError('evaluation', PromptId.EVAL, serializedError);
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
      this.logStageError('evaluation', PromptId.EVAL, serializedError);
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
      trace.error?.message ?? 'No se pudo obtener un plan valido del LLM.',
    );
  }

  async planWithTrace(
    input: {
      sourceCodePayload: string;
      assignmentContext: AssignmentContext;
    },
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<BuilderPlanContractV2>> {
    const composedPrompt = composePlanPrompt(
      input.sourceCodePayload,
      input.assignmentContext,
      this.planMaxInputChars,
    );

    const snapshot = this.createPromptSnapshot(
      'plan',
      PromptId.PLAN,
      this.planProfile,
      composedPrompt,
      this.planSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null = null;

    try {
      response = await this.ollamaGenerationService.generate({
        stage: 'plan',
        promptId: PromptId.PLAN,
        prompt: composedPrompt.prompt,
        systemPrompt: this.planSystemPrompt,
        profile: this.planProfile,
      });
    } catch (error: unknown) {
      const serializedError = this.serializeError(error);
      this.logStageError('plan', PromptId.PLAN, serializedError);
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
      this.logStageError('plan', PromptId.PLAN, serializedError);
      this.logger.error(
        `Fallo al parsear respuesta del Planner. Respuesta bruta: ${response}`,
      );
      return this.buildTrace(snapshot, response, serializedError);
    }
  }

  private createPromptSnapshot(
    stage: BuilderLlmStagePromptSnapshot['stage'],
    promptId: PromptId,
    modelProfile: OllamaModelProfile,
    prompt: ComposedPromptPayload,
    systemPrompt: string | null,
  ): BuilderLlmStagePromptSnapshot {
    return {
      stage,
      promptId,
      model: modelProfile.model,
      systemPrompt,
      prompt: prompt.prompt,
      sections: prompt.sections,
      modelProfile,
      createdAt: new Date().toISOString(),
    };
  }

  private logStageError(
    stage: 'plan' | 'evaluation',
    promptId: PromptId,
    error: BuilderLlmStageErrorInfo,
  ): void {
    const runtime = this.ollamaGenerationService.getRuntimeConfig();
    const profile =
      stage === 'plan' ? this.planProfile : this.evaluationProfile;

    this.logger.error(
      JSON.stringify({
        event: 'builder_llm_stage_error',
        stage,
        promptId,
        model: profile.model,
        baseModel: profile.baseModel,
        profileVersion: profile.profileVersion,
        baseUrl: runtime.baseUrl,
        timeoutMs: runtime.timeoutMs,
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
