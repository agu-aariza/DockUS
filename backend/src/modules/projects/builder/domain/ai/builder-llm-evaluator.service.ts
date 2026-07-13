import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderFactsContractV2,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
  BuilderPlanContractV2,
} from '../builder.types';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BedrockGenerationService } from '../../../../../shared/infrastructure/ai/bedrock-generation.service';
import type {
  LlmGenerateRequest,
  LlmModelProfile,
} from '../../../../../shared/infrastructure/ai/llm.types';
import { BuilderConfigProvider } from '../builder-config.provider';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';
import { parseBuilderFactsContractV2 } from './builder-facts-contract.parser';
import { resolveBuilderModelProfile } from './builder-llm-model-profile';
import { parseBuilderPlanContractV2 } from './builder-plan-contract.parser';
import {
  composeEvaluationPrompt,
  composeFactsPrompt,
  composePlanPrompt,
} from './builder-prompt-composer';
import {
  createPromptSnapshot,
  logStageError,
  buildTrace,
  serializeError,
} from './builder-llm-trace.util';

interface EvaluatorInput {
  projectRootDir: string;
  sourceCodePayload: string;
  facts: BuilderFactsContractV2;
  assignmentContext: AssignmentContext;
  plannerAssessment?: BuilderPlanContractV2;
}

interface FactsExtractorInput {
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
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
  private readonly factsMaxInputChars: number;
  private readonly evalMaxInputChars: number;
  private readonly systemPrompt: string;
  private readonly planSystemPrompt: string;
  private readonly factsSystemPrompt: string;
  private readonly evaluationProfile: LlmModelProfile;
  private readonly planProfile: LlmModelProfile;
  private readonly factsProfile: LlmModelProfile;

  constructor(
    private readonly builderConfigProvider: BuilderConfigProvider,
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly logTrimmer: BuilderLogTrimmer,
    private readonly llmService: BedrockGenerationService,
  ) {
    this.planMaxInputChars = this.builderConfigProvider.planMaxInputChars;
    this.factsMaxInputChars = this.builderConfigProvider.factsMaxInputChars;
    this.evalMaxInputChars = this.builderConfigProvider.evalMaxInputChars;
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.EVAL);
    this.planSystemPrompt = this.promptRegistry.getPrompt(PromptId.PLAN);
    this.factsSystemPrompt = this.promptRegistry.getPrompt(PromptId.FACTS);
    this.evaluationProfile = resolveBuilderModelProfile(
      'evaluation',
      this.configService,
    );
    this.planProfile = resolveBuilderModelProfile('plan', this.configService);
    this.factsProfile = resolveBuilderModelProfile('facts', this.configService);
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
      input.facts,
      input.assignmentContext,
      input.plannerAssessment,
      this.evalMaxInputChars,
    );

    const snapshot = createPromptSnapshot(
      'evaluation',
      PromptId.EVAL,
      this.evaluationProfile,
      composedPrompt,
      this.systemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null;

    try {
      response = await this.generateText({
        stage: 'evaluation',
        promptId: PromptId.EVAL,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile: this.evaluationProfile,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'evaluation',
        PromptId.EVAL,
        this.evaluationProfile,
        serializedError,
        this.logger,
      );
      return buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderEvaluationContractV2(response);
      return buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'evaluation',
        PromptId.EVAL,
        this.evaluationProfile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del Evaluador. Respuesta bruta: ${response}`,
      );
      return buildTrace(snapshot, response, serializedError);
    }
  }

  async extractFacts(
    input: FactsExtractorInput,
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderFactsContractV2> {
    const trace = await this.extractFactsWithTrace(input, hooks);
    if (trace.parsedContract) {
      return trace.parsedContract;
    }

    throw new Error(
      trace.error?.message ??
        'No se pudo extraer los hechos de ejecucion del LLM.',
    );
  }

  async extractFactsWithTrace(
    input: FactsExtractorInput,
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<BuilderFactsContractV2>> {
    const composedPrompt = composeFactsPrompt(
      input.sourceCodePayload,
      this.logTrimmer.smartTrim(input.executionLogs) ||
        'No execution logs were captured.',
      input.assignmentContext,
      this.factsMaxInputChars,
    );

    const snapshot = createPromptSnapshot(
      'facts',
      PromptId.FACTS,
      this.factsProfile,
      composedPrompt,
      this.factsSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null;

    try {
      response = await this.generateText({
        stage: 'facts',
        promptId: PromptId.FACTS,
        prompt: composedPrompt.prompt,
        systemPrompt: this.factsSystemPrompt,
        profile: this.factsProfile,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'facts',
        PromptId.FACTS,
        this.factsProfile,
        serializedError,
        this.logger,
      );
      return buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderFactsContractV2(response);
      return buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'facts',
        PromptId.FACTS,
        this.factsProfile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del extractor de hechos. Respuesta bruta: ${response}`,
      );
      return buildTrace(snapshot, response, serializedError);
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

    const snapshot = createPromptSnapshot(
      'plan',
      PromptId.PLAN,
      this.planProfile,
      composedPrompt,
      this.planSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null;

    try {
      response = await this.generateText({
        stage: 'plan',
        promptId: PromptId.PLAN,
        prompt: composedPrompt.prompt,
        systemPrompt: this.planSystemPrompt,
        profile: this.planProfile,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'plan',
        PromptId.PLAN,
        this.planProfile,
        serializedError,
        this.logger,
      );
      return buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderPlanContractV2(response);
      return buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'plan',
        PromptId.PLAN,
        this.planProfile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del Planner. Respuesta bruta: ${response}`,
      );
      return buildTrace(snapshot, response, serializedError);
    }
  }

  /**
   * El consumo de tokens lo registra `BedrockGenerationService`; aquí solo
   * interesa el texto de la respuesta.
   */
  private async generateText(request: LlmGenerateRequest): Promise<string> {
    const { text } = await this.llmService.generate(request);
    return text;
  }
}
