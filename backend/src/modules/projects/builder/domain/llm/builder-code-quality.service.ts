import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderLlmStageErrorInfo,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
} from '../builder.types';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import {
  ILlmGenerationService,
  LLM_GENERATION_SERVICE,
} from '../../../../../shared/infrastructure/ai/llm-generation.token';
import type { LlmModelProfile } from '../../../../../shared/infrastructure/ai/llm.types';
import { BedrockRequestError } from '../../../../../shared/infrastructure/ai/bedrock-request.util';
import { parseBuilderCodeQualityContractV2 } from './builder-code-quality-contract.parser';
import { resolveBuilderModelProfile } from './builder-llm-model-profile';
import {
  ComposedPromptPayload,
  composeQualityPrompt,
} from './builder-prompt-composer';

export interface CodeQualityInput {
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
  assessment: BuilderEvaluationContractV2;
}

export type BuilderCodeQualityPromptSnapshot = BuilderLlmStagePromptSnapshot;
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
  private readonly modelProfile: LlmModelProfile;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    @Inject(LLM_GENERATION_SERVICE)
    private readonly llmService: ILlmGenerationService,
  ) {
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_QUALITY_MAX_INPUT_CHARS',
      20000,
    );
    this.systemPrompt = this.promptRegistry.getPrompt(
      PromptId.TECHNICAL_FEEDBACK,
    );
    this.modelProfile = resolveBuilderModelProfile(
      'quality',
      this.configService,
    );
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
    const composedPrompt = composeQualityPrompt(
      input.sourceCodePayload,
      input.executionLogs || 'No execution logs were captured.',
      input.assignmentContext,
      input.assessment,
      this.maxInputChars,
    );

    const snapshot = this.createPromptSnapshot(composedPrompt);
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null = null;

    try {
      response = await this.llmService.generate({
        stage: 'quality',
        promptId: PromptId.TECHNICAL_FEEDBACK,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile: this.modelProfile,
        format: 'json',
      });
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

  private createPromptSnapshot(
    prompt: ComposedPromptPayload,
  ): BuilderCodeQualityPromptSnapshot {
    return {
      stage: 'quality',
      promptId: PromptId.TECHNICAL_FEEDBACK,
      model: this.modelProfile.modelId,
      systemPrompt: this.systemPrompt,
      prompt: prompt.prompt,
      sections: prompt.sections,
      modelProfile: this.modelProfile,
      createdAt: new Date().toISOString(),
    };
  }

  private logStageError(error: BuilderLlmStageErrorInfo): void {
    this.logger.error(
      JSON.stringify({
        event: 'builder_llm_stage_error',
        stage: 'quality',
        promptId: PromptId.TECHNICAL_FEEDBACK,
        modelId: this.modelProfile.modelId,
        profileVersion: this.modelProfile.profileVersion,
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
      schemaVersion: 'builder-llm/v2',
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
    if (error instanceof BedrockRequestError) {
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
