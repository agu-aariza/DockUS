import { Injectable, Logger } from '@nestjs/common';
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
import { LlmGenerationRouter } from '../../../../../shared/infrastructure/ai/llm-generation.router';
import type {
  LlmGenerateRequest,
  LlmGenerateResult,
} from '../../../../../shared/infrastructure/ai/llm.types';
import { BuilderConfigProvider } from '../builder-config.provider';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';
import { parseBuilderFactsContractV2 } from './builder-facts-contract.parser';
import { parseBuilderPlanContractV2 } from './builder-plan-contract.parser';
import { BuilderLlmConfigService } from '../../infrastructure/config/builder-llm-config.service';
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

  constructor(
    private readonly builderConfigProvider: BuilderConfigProvider,
    private readonly promptRegistry: PromptRegistryService,
    private readonly logTrimmer: BuilderLogTrimmer,
    private readonly llmService: LlmGenerationRouter,
    private readonly llmConfigService: BuilderLlmConfigService,
  ) {
    this.planMaxInputChars = this.builderConfigProvider.planMaxInputChars;
    this.factsMaxInputChars = this.builderConfigProvider.factsMaxInputChars;
    this.evalMaxInputChars = this.builderConfigProvider.evalMaxInputChars;
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.EVAL);
    this.planSystemPrompt = this.promptRegistry.getPrompt(PromptId.PLAN);
    this.factsSystemPrompt = this.promptRegistry.getPrompt(PromptId.FACTS);
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

    const { profile, credentials } =
      await this.llmConfigService.resolveStageProfile('evaluation');

    const snapshot = createPromptSnapshot(
      'evaluation',
      PromptId.EVAL,
      profile,
      composedPrompt,
      this.systemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: LlmGenerateResult;

    try {
      response = await this.generateText({
        stage: 'evaluation',
        promptId: PromptId.EVAL,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile,
        credentials,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'evaluation',
        PromptId.EVAL,
        profile,
        serializedError,
        this.logger,
      );
      return buildTrace<BuilderEvaluationContractV2>(
        snapshot,
        null,
        serializedError,
      );
    }

    try {
      const parsedContract = parseBuilderEvaluationContractV2(response.text);
      return buildTrace<BuilderEvaluationContractV2>(
        snapshot,
        response.text,
        null,
        parsedContract,
        response.usage,
      );
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'evaluation',
        PromptId.EVAL,
        profile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del Evaluador. Respuesta bruta: ${response.text}`,
      );
      return buildTrace<BuilderEvaluationContractV2>(
        snapshot,
        response.text,
        serializedError,
        null,
        response.usage,
      );
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

    const { profile, credentials } =
      await this.llmConfigService.resolveStageProfile('facts');

    const snapshot = createPromptSnapshot(
      'facts',
      PromptId.FACTS,
      profile,
      composedPrompt,
      this.factsSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: LlmGenerateResult;

    try {
      response = await this.generateText({
        stage: 'facts',
        promptId: PromptId.FACTS,
        prompt: composedPrompt.prompt,
        systemPrompt: this.factsSystemPrompt,
        profile,
        credentials,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'facts',
        PromptId.FACTS,
        profile,
        serializedError,
        this.logger,
      );
      return buildTrace<BuilderFactsContractV2>(
        snapshot,
        null,
        serializedError,
      );
    }

    try {
      const parsedContract = parseBuilderFactsContractV2(response.text);
      return buildTrace<BuilderFactsContractV2>(
        snapshot,
        response.text,
        null,
        parsedContract,
        response.usage,
      );
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'facts',
        PromptId.FACTS,
        profile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del extractor de hechos. Respuesta bruta: ${response.text}`,
      );
      return buildTrace<BuilderFactsContractV2>(
        snapshot,
        response.text,
        serializedError,
        null,
        response.usage,
      );
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

    const { profile, credentials } =
      await this.llmConfigService.resolveStageProfile('plan');

    const snapshot = createPromptSnapshot(
      'plan',
      PromptId.PLAN,
      profile,
      composedPrompt,
      this.planSystemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: LlmGenerateResult;

    try {
      response = await this.generateText({
        stage: 'plan',
        promptId: PromptId.PLAN,
        prompt: composedPrompt.prompt,
        systemPrompt: this.planSystemPrompt,
        profile,
        credentials,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'plan',
        PromptId.PLAN,
        profile,
        serializedError,
        this.logger,
      );
      return buildTrace<BuilderPlanContractV2>(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderPlanContractV2(response.text);
      return buildTrace<BuilderPlanContractV2>(
        snapshot,
        response.text,
        null,
        parsedContract,
        response.usage,
      );
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'plan',
        PromptId.PLAN,
        profile,
        serializedError,
        this.logger,
      );
      this.logger.error(
        `Fallo al parsear respuesta del Planner. Respuesta bruta: ${response.text}`,
      );
      return buildTrace<BuilderPlanContractV2>(
        snapshot,
        response.text,
        serializedError,
        null,
        response.usage,
      );
    }
  }

  private async generateText(
    request: LlmGenerateRequest,
  ): Promise<LlmGenerateResult> {
    return this.llmService.generate(request);
  }
}
