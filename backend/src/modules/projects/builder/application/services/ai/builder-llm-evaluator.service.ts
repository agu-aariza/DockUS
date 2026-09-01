/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-llm-evaluator.service).
 *
 * @module builder-llm-evaluator.service
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderExecutionResult,
  BuilderFactsContractV2,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
  BuilderPlanContractV2,
} from '../../../domain/builder.types';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import type {
  BuilderLlmPromptStage,
  LlmGenerateResult,
  LlmModelProfile,
} from '../../../../../../shared/infrastructure/ai/llm.types';
import { BuilderLlmDispatcherService } from './builder-llm-dispatcher.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { BuilderLogTrimmer } from '../../../infrastructure/utils/builder-log-trimmer.util';
import type { ComposedPromptPayload } from '../../../domain/ai/builder-prompt-composer';
import { parseBuilderEvaluationContractV2 } from '../../../domain/ai/builder-evaluation-contract.parser';
import { parseBuilderFactsContractV2 } from '../../../domain/ai/builder-facts-contract.parser';
import { parseBuilderPlanContractV2 } from '../../../domain/ai/builder-plan-contract.parser';
import { BuilderLlmConfigService } from '../config/builder-llm-config.service';
import {
  composeEvaluationPrompt,
  composeFactsPrompt,
  composePlanPrompt,
} from '../../../domain/ai/builder-prompt-composer';
import {
  createPromptSnapshot,
  logStageError,
  buildTrace,
  serializeError,
  sumUsage,
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
  execution: BuilderExecutionResult;
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
    private readonly llmDispatcher: BuilderLlmDispatcherService,
    private readonly llmConfigService: BuilderLlmConfigService,
  ) {
    this.planMaxInputChars = this.builderConfigProvider.planMaxInputChars;
    this.factsMaxInputChars = this.builderConfigProvider.factsMaxInputChars;
    this.evalMaxInputChars = this.builderConfigProvider.evalMaxInputChars;
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.EVAL);
    this.planSystemPrompt = this.promptRegistry.getPrompt(PromptId.PLAN);
    this.factsSystemPrompt = this.promptRegistry.getPrompt(PromptId.FACTS);
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

    return this.runContractStage<BuilderEvaluationContractV2>(
      'evaluation',
      PromptId.EVAL,
      composedPrompt,
      this.systemPrompt,
      parseBuilderEvaluationContractV2,
      'del Evaluador',
      hooks,
    );
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
      this.logTrimmer.smartTrim(serializeExecutionResult(input.execution)) ||
        'No execution logs were captured.',
      input.assignmentContext,
      this.factsMaxInputChars,
    );

    return this.runContractStage<BuilderFactsContractV2>(
      'facts',
      PromptId.FACTS,
      composedPrompt,
      this.factsSystemPrompt,
      parseBuilderFactsContractV2,
      'del extractor de hechos',
      hooks,
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

    return this.runContractStage<BuilderPlanContractV2>(
      'plan',
      PromptId.PLAN,
      composedPrompt,
      this.planSystemPrompt,
      parseBuilderPlanContractV2,
      'del Planner',
      hooks,
    );
  }

  /**
   * Ejecuta una etapa que debe devolver un contrato: despacha la llamada con
   * conmutación entre proveedores y reintenta **una vez** si la respuesta no
   * es parseable.
   *
   * El reintento de contrato atiende un fallo que hasta ahora
   * tumbaba el run entero: la generación es estocástica, de modo que una misma
   * petición que devuelve JSON mal formado suele devolverlo bien al segundo
   * intento. Se reintenta **una sola vez** a propósito: cada intento se
   * factura, y si el modelo no respeta el contrato dos veces seguidas el
   * problema está en el prompt o en el modelo elegido, no en el azar, y
   * conviene que se vea como fallo en lugar de multiplicar el gasto.
   *
   * La instantánea del prompt se crea con el perfil **realmente usado** en cada
   * intento, no con el asignado al rol: si hubo conmutación, la evidencia debe
   * decir qué modelo produjo la respuesta.
   */
  private async runContractStage<TContract>(
    stage: BuilderLlmPromptStage,
    promptId: PromptId,
    composedPrompt: ComposedPromptPayload,
    systemPrompt: string,
    parse: (raw: string) => TContract,
    parseErrorLabel: string,
    hooks?: BuilderLlmTraceHooks,
  ): Promise<BuilderLlmStageTrace<TContract>> {
    let snapshot: BuilderLlmStagePromptSnapshot | null = null;

    const attempt = async (): Promise<{
      response: LlmGenerateResult;
      profile: LlmModelProfile;
    }> => {
      const outcome = await this.llmDispatcher.dispatch(
        stage,
        (profile, credentials) => ({
          stage,
          promptId,
          prompt: composedPrompt.prompt,
          systemPrompt,
          profile,
          credentials,
          format: 'json' as const,
        }),
        async (profile) => {
          snapshot = createPromptSnapshot(
            stage,
            promptId,
            profile,
            composedPrompt,
            systemPrompt,
          );
          await hooks?.onBeforeCall?.(snapshot);
        },
      );
      return { response: outcome.result, profile: outcome.profile };
    };

    let response: LlmGenerateResult;
    let profile: LlmModelProfile;
    try {
      ({ response, profile } = await attempt());
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      // `snapshot` está poblado salvo que fallara la propia resolución de la
      // cadena de proveedores, antes de cualquier intento.
      const fallbackSnapshot =
        snapshot ??
        createPromptSnapshot(
          stage,
          promptId,
          (await this.llmConfigService.resolveStageProfile(stage)).profile,
          composedPrompt,
          systemPrompt,
        );
      logStageError(
        stage,
        promptId,
        fallbackSnapshot.modelProfile,
        serializedError,
        this.logger,
      );
      return buildTrace<TContract>(fallbackSnapshot, null, serializedError);
    }

    try {
      return buildTrace<TContract>(
        snapshot!,
        response.text,
        null,
        parse(response.text),
        response.usage,
      );
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'builder_llm_contract_retry',
          stage,
          promptId,
          modelId: profile.modelId,
        }),
      );
    }

    // Segundo y último intento.
    const firstAttemptUsage = response.usage;
    try {
      ({ response, profile } = await attempt());
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(stage, promptId, profile, serializedError, this.logger);
      return buildTrace<TContract>(
        snapshot!,
        null,
        serializedError,
        null,
        firstAttemptUsage,
      );
    }

    try {
      return buildTrace<TContract>(
        snapshot!,
        response.text,
        null,
        parse(response.text),
        // ambos intentos se facturan; el trace final debe reflejar
        // el consumo de los dos, no solo el del segundo.
        sumUsage(firstAttemptUsage, response.usage),
      );
    } catch (parseError) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(stage, promptId, profile, serializedError, this.logger);
      this.logger.error(
        `Fallo al parsear respuesta ${parseErrorLabel} tras dos intentos. Respuesta bruta: ${response.text}`,
      );
      return buildTrace<TContract>(
        snapshot!,
        response.text,
        serializedError,
        null,
        sumUsage(firstAttemptUsage, response.usage),
      );
    }
  }
}
