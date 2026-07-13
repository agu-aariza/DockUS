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
import { BedrockGenerationService } from '../../../../../shared/infrastructure/ai/bedrock-generation.service';
import type {
  LlmGenerateRequest,
  LlmModelProfile,
} from '../../../../../shared/infrastructure/ai/llm.types';
import { parseBuilderCodeQualityContractV2 } from './builder-code-quality-contract.parser';
import { resolveBuilderModelProfile } from './builder-llm-model-profile';
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
  private readonly modelProfile: LlmModelProfile;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly llmService: BedrockGenerationService,
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

    const snapshot = createPromptSnapshot(
      'quality',
      PromptId.TECHNICAL_FEEDBACK,
      this.modelProfile,
      composedPrompt,
      this.systemPrompt,
    );
    await hooks?.onBeforeCall?.(snapshot);

    let response: string | null;

    try {
      response = await this.generateText({
        stage: 'quality',
        promptId: PromptId.TECHNICAL_FEEDBACK,
        prompt: composedPrompt.prompt,
        systemPrompt: this.systemPrompt,
        profile: this.modelProfile,
        format: 'json',
      });
    } catch (error: unknown) {
      const serializedError = serializeError(error);
      logStageError(
        'quality',
        PromptId.TECHNICAL_FEEDBACK,
        this.modelProfile,
        serializedError,
        this.logger,
      );
      return buildTrace(snapshot, null, serializedError);
    }

    try {
      const parsedContract = parseBuilderCodeQualityContractV2(response);
      return buildTrace(snapshot, response, null, parsedContract);
    } catch (parseError: unknown) {
      const serializedError = serializeError(parseError, 'invalid_contract');
      logStageError(
        'quality',
        PromptId.TECHNICAL_FEEDBACK,
        this.modelProfile,
        serializedError,
        this.logger,
      );
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      this.logger.error(
        `Fallo al parsear respuesta de calidad. Respuesta bruta: ${response}. Error: ${message}`,
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
