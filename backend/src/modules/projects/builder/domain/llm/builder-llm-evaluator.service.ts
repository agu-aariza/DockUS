import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssignmentContext, BuilderLlmAssessment } from '../builder.types';
import { parseBuilderLlmAssessment } from './builder-llm-assessment.parser';
import {
  PromptId,
  PromptRegistryService,
} from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';

export interface EvaluatorInput {
  projectRootDir: string;
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
}

@Injectable()
export class BuilderLlmEvaluatorService {
  private readonly logger = new Logger(BuilderLlmEvaluatorService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly planModel: string;
  private readonly timeoutMs: number;
  private readonly systemPrompt: string;
  private readonly planSystemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly logTrimmer: BuilderLogTrimmer,
  ) {
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_EVAL_MODEL',
      'dockus-builder-eval',
    );
    this.planModel = this.configService.get<string>(
      'BUILDER_OLLAMA_PLAN_MODEL',
      'qwen2.5-coder:1.5b',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.systemPrompt = this.promptRegistry.getPrompt(PromptId.EVAL);
    this.planSystemPrompt = this.promptRegistry.getPrompt(PromptId.PLAN);
  }

  async evaluate(input: EvaluatorInput): Promise<BuilderLlmAssessment> {
    this.logger.log('Iniciando evaluación integral con LLM.');

    const userPrompt = `
Instrucciones de la rúbrica:
${input.assignmentContext.rubricInstructions}

Código fuente del alumno:
${input.sourceCodePayload}

Resultado de la ejecución de los tests del profesor (Logs):
${this.logTrimmer.smartTrim(input.executionLogs) || 'No hay logs o no se ejecutaron tests.'}
`;

    try {
      const response = await this.callSpecificModel(
        this.model,
        userPrompt,
        this.systemPrompt,
      );
      return parseBuilderLlmAssessment(response, { mode: 'evaluation' });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en evaluación LLM: ${errorMsg}`);
      throw error;
    }
  }

  async plan(input: {
    sourceCodePayload: string;
    assignmentContext: AssignmentContext;
  }): Promise<BuilderLlmAssessment> {
    this.logger.log('Iniciando planificación con LLM.');

    const userPrompt = `
EXPECTATIVAS DEL PROFESOR:
Tipo de proyecto esperado: ${input.assignmentContext.expectedType}
Instrucciones de rúbrica: ${input.assignmentContext.rubricInstructions}

WORKSPACE DEL ALUMNO (ARCHIVOS):
${input.sourceCodePayload}
`;

    try {
      const response = await this.callSpecificModel(
        this.planModel,
        userPrompt,
        this.planSystemPrompt,
      );
      try {
        return parseBuilderLlmAssessment(response, { mode: 'planning' });
      } catch (parseError) {
        this.logger.error(`Fallo al parsear respuesta del Planner. Respuesta bruta: ${response}`);
        throw parseError;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en planificación LLM: ${errorMsg}`);
      throw error;
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
        throw new Error(
          `Ollama devolvió ${response.status}: ${details.slice(0, 250)}`,
        );
      }

      const payload = (await response.json()) as { response?: unknown };
      if (typeof payload.response !== 'string') {
        throw new Error(
          'Respuesta de evaluación LLM sin campo response string.',
        );
      }

      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout agotado al evaluar builder con LLM.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
