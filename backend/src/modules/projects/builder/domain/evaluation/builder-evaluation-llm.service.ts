import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  BuilderLlmAssessment,
  BuilderLlmPhaseResult,
  ExecutionContext,
  StageResult,
  StaticFinding,
} from '../builder.types';
import { parseBuilderLlmAssessment } from '../llm/builder-llm-assessment.parser';

@Injectable()
export class BuilderEvaluationLlmService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_LLM_ASSIST_ENABLED',
        true,
      ),
    );
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_MODEL',
      'qwen2.5-coder:7b',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_ASSIST_MAX_INPUT_CHARS',
      15000,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async evaluate(input: {
    planningAssessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    warnings: string[];
    executionContext: ExecutionContext;
    evidenceArtifacts: Array<{ id: string; type: string }>;
    observedEvidence: unknown;
  }): Promise<BuilderLlmPhaseResult | null> {
    if (!this.enabled) {
      return null;
    }

    const prompt = this.buildPrompt(input);
    const raw = await this.callModel(prompt);
    return {
      model: this.model,
      assessment: this.parseResponse(raw),
    };
  }

  private buildPrompt(input: {
    planningAssessment: BuilderLlmAssessment;
    stageResults: StageResult[];
    staticFindings: StaticFinding[];
    warnings: string[];
    executionContext: ExecutionContext;
    evidenceArtifacts: Array<{ id: string; type: string }>;
    observedEvidence: unknown;
  }): string {
    const payload = JSON.stringify(
      {
        planningAssessment: input.planningAssessment,
        stageResults: input.stageResults,
        staticFindings: input.staticFindings.slice(0, 25),
        warnings: input.warnings.slice(0, 30),
        executionContext: input.executionContext,
        evidenceArtifacts: input.evidenceArtifacts
          .slice(0, 50)
          .map((artifact) => ({
            id: artifact.id,
            type: artifact.type,
          })),
        observedEvidence: input.observedEvidence,
      },
      null,
      2,
    ).slice(0, this.maxInputChars);

    return [
      'Eres el evaluador canónico del builder Python de DockUS.',
      'Debes emitir la evaluación final del proyecto basándote en la evidencia observada, no en heurísticas externas.',
      'Recibes una hipótesis inicial del planner LLM y el resultado real de build, despliegue, healthcheck y tests.',
      '',
      'Puedes corregir la hipótesis inicial si la evidencia lo justifica.',
      '',
      'Taxonomía estructural:',
      '- T1 Script standalone',
      '- T2 CLI application',
      '- T3 Python package/library',
      '- T4 Web API ligera (Flask/FastAPI)',
      '- T5 Web app estructurada (Django)',
      '- T6 Worker/batch job',
      '- T7 Ambiguo o híbrido',
      '- T8 No clasificable',
      '',
      'Capacidades:',
      '- C1 instalable',
      '- C2 ejecutable',
      '- C3 desplegable como servicio',
      '- C4 testeable',
      '- C5 observable con healthcheck',
      '- C6 requiere intervención/configuración externa',
      '',
      'Estados evaluativos:',
      '- E1 evaluación completa posible',
      '- E2 evaluación parcial posible',
      '- E3 solo análisis estático viable',
      '- E4 evaluación bloqueada por defectos graves',
      '',
      'Devuelve SOLO JSON UTF-8 válido, sin markdown, con la misma forma exacta del planner:',
      '{',
      '  "structuralType": "T1|T2|T3|T4|T5|T6|T7|T8",',
      '  "capabilities": {',
      '    "C1": { "status": "yes|no|unknown", "rationale": "string" },',
      '    "C2": { "status": "yes|no|unknown", "rationale": "string" },',
      '    "C3": { "status": "yes|no|unknown", "rationale": "string" },',
      '    "C4": { "status": "yes|no|unknown", "rationale": "string" },',
      '    "C5": { "status": "yes|no|unknown", "rationale": "string" },',
      '    "C6": { "status": "yes|no|unknown", "rationale": "string" }',
      '  },',
      '  "evaluativeState": "E1|E2|E3|E4",',
      '  "confidence": "low|medium|high",',
      '  "rationale": "string",',
      '  "externalRequirements": ["string"],',
      '  "recipe": {',
      '    "install": [["cmd","arg"]],',
      '    "run": ["cmd","arg"] o null,',
      '    "test": [["cmd","arg"]],',
      '    "healthcheck": ["cmd","arg"] o null,',
      '    "servicePort": 8000 o null,',
      '    "systemPackages": ["string"]',
      '  },',
      '  "evidenceSummary": "string",',
      '  "observedEvidence": ["string"],',
      '  "evaluationLimits": ["string"]',
      '}',
      '',
      'Reglas:',
      '- El estado final debe reflejar la evidencia realmente observada.',
      '- T7 no puede terminar en E1.',
      '- T8 debe terminar en E4.',
      '- Si falta configuración externa esencial, marca C6=yes y evita sobreestimar la evaluabilidad.',
      '- Si el proyecto no pudo construirse o ejecutarse, usa esa evidencia en observedEvidence y evaluationLimits.',
      '- No inventes artefactos ni logs no presentes.',
      '',
      'Entrada de evaluación:',
      payload,
    ].join('\n');
  }

  private async callModel(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          prompt,
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

  private parseResponse(raw: string): BuilderLlmPhaseResult['assessment'] {
    return parseBuilderLlmAssessment(raw, { mode: 'evaluation' });
  }
}
