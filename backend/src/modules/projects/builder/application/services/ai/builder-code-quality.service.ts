/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-code-quality.service).
 *
 * @module builder-code-quality.service
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderExecutionResult,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
} from '../../../domain/builder.types';
import { serializeExecutionResult } from '../../../domain/ai/builder-execution-result.util';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BuilderLlmDispatcherService } from './builder-llm-dispatcher.service';
import type { LlmGenerateResult } from '../../../../../../shared/infrastructure/ai/llm.types';
import { parseBuilderCodeQualityContractV2 } from '../../../domain/ai/builder-code-quality-contract.parser';
import { BuilderLlmConfigService } from '../config/builder-llm-config.service';
import { composeQualityPrompt } from '../../../domain/ai/builder-prompt-composer';
import {
  createPromptSnapshot,
  logStageError,
  buildTrace,
  serializeError,
} from './builder-llm-trace.util';

interface CodeQualityInput {
  sourceCodePayload: string;
  execution: BuilderExecutionResult;
  assignmentContext: AssignmentContext;
  assessment: BuilderEvaluationContractV2;
}

type BuilderCodeQualityPromptSnapshot = BuilderLlmStagePromptSnapshot;
export type BuilderCodeQualityTrace =
  BuilderLlmStageTrace<BuilderCodeQualityContractV2>;

interface BuilderCodeQualityTraceHooks {
  onBeforeCall?: (
    snapshot: BuilderCodeQualityPromptSnapshot,
  ) => Promise<void> | void;
}

@Injectable()
export class BuilderCodeQualityService {
  private readonly logger = new Logger(BuilderCodeQualityService.name);
  private readonly maxInputChars: number;
  private readonly systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly llmDispatcher: BuilderLlmDispatcherService,
    private readonly llmConfigService: BuilderLlmConfigService,
  ) {
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_QUALITY_MAX_INPUT_CHARS',
      20000,
    );
    this.systemPrompt = this.promptRegistry.getPrompt(
      PromptId.TECHNICAL_FEEDBACK,
    );
  }

  async analyze(
    input: CodeQualityInput,
  ): Promise<BuilderCodeQualityContractV2> {
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
    const composedPrompt = composeQualityPrompt(
      input.sourceCodePayload,
      serializeExecutionResult(input.execution) ||
        'No execution logs were captured.',
      input.assignmentContext,
      input.assessment,
      this.maxInputChars,
    );

    // Perfil asignado al rol. Sirve de valor inicial para que la instantánea y
    // el registro de error existan aunque la conmutación falle antes del primer
    // intento; en cuanto hay intento, ambos pasan a reflejar el proveedor real.
    const primary = await this.llmConfigService.resolveStageProfile('quality');
    let profile = primary.profile;
    let snapshot = createPromptSnapshot(
      'quality',
      PromptId.TECHNICAL_FEEDBACK,
      profile,
      composedPrompt,
      this.systemPrompt,
    );

    let response: LlmGenerateResult;

    try {
      const outcome = await this.llmDispatcher.dispatch(
        'quality',
        (candidateProfile, credentials) => ({
          stage: 'quality' as const,
          promptId: PromptId.TECHNICAL_FEEDBACK,
          prompt: composedPrompt.prompt,
          systemPrompt: this.systemPrompt,
          profile: candidateProfile,
          credentials,
          format: 'json' as const,
        }),
        async (candidateProfile) => {
          profile = candidateProfile;
          snapshot = createPromptSnapshot(
            'quality',
            PromptId.TECHNICAL_FEEDBACK,
            candidateProfile,
            composedPrompt,
            this.systemPrompt,
          );
          await hooks?.onBeforeCall?.(snapshot);
        },
      );
      response = outcome.result;
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'quality',
        PromptId.TECHNICAL_FEEDBACK,
        profile,
        serializedError,
        this.logger,
      );
      return buildTrace<BuilderCodeQualityContractV2>(
        snapshot,
        null,
        serializedError,
      );
    }

    try {
      const parsedContract = parseBuilderCodeQualityContractV2(response.text);
      return buildTrace<BuilderCodeQualityContractV2>(
        snapshot,
        response.text,
        null,
        parsedContract,
        response.usage,
      );
    } catch (parseError: unknown) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'quality',
        PromptId.TECHNICAL_FEEDBACK,
        profile,
        serializedError,
        this.logger,
      );
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      this.logger.error(
        `Fallo al parsear respuesta de calidad. Respuesta bruta: ${response.text}. Error: ${message}`,
      );
      return buildTrace<BuilderCodeQualityContractV2>(
        snapshot,
        response.text,
        serializedError,
        null,
        response.usage,
      );
    }
  }
}
