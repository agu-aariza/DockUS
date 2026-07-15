import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmStageTrace,
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
import { parseBuilderCodeQualityContractV2 } from './builder-code-quality-contract.parser';
import { BuilderLlmConfigService } from '../../infrastructure/config/builder-llm-config.service';
import { composeQualityPrompt } from './builder-prompt-composer';
import {
  createPromptSnapshot,
  logStageError,
  buildTrace,
  serializeError,
} from './builder-llm-trace.util';

interface CodeQualityInput {
  sourceCodePayload: string;
  executionLogs: string;
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
    private readonly llmService: LlmGenerationRouter,
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
      input.executionLogs || 'No execution logs were captured.',
      input.assignmentContext,
      input.assessment,
      this.maxInputChars,
    );

    const { profile, credentials } =
      await this.llmConfigService.resolveStageProfile('quality');

    const snapshot = createPromptSnapshot(
      'quality',
      PromptId.TECHNICAL_FEEDBACK,
      profile,
      composedPrompt,
      this.systemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: LlmGenerateResult;

    try {
      response = await this.generateText({
        stage: 'quality',
        promptId: PromptId.TECHNICAL_FEEDBACK,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile,
        credentials,
        format: 'json',
      });
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

  private async generateText(
    request: LlmGenerateRequest,
  ): Promise<LlmGenerateResult> {
    return this.llmService.generate(request);
  }
}
