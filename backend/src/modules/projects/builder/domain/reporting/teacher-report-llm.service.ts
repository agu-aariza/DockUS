import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StageResult,
  StaticFinding,
  StrategyResult,
  TeacherReport,
  ValidationResult,
} from '../builder.types';

interface TeacherReportLlmOutput {
  findingsForTeachers: string;
  evidenceReadableText: string;
  naturalExplanation: string;
  humanInterpretation: string;
  classificationSupport: string;
  staticFindingsSupport: string;
  strategySupport: string;
  validationSupport: string;
}

@Injectable()
export class TeacherReportLlmService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;

  constructor(private readonly configService: ConfigService) {
    const legacyEnabled = this.configService.get<string | boolean>(
      'BUILDER_LLM_REPORT_ENABLED',
      true,
    );
    this.enabled = this.toBoolean(
      this.configService.get<string | boolean>(
        'BUILDER_LLM_ASSIST_ENABLED',
        legacyEnabled,
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
      this.configService.get<number>('BUILDER_LLM_REPORT_MAX_INPUT_CHARS', 15000),
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generateSummary(input: {
    report: TeacherReport;
    strategyResult: StrategyResult;
    stageResults: StageResult[];
    validationResult: ValidationResult;
    staticFindings: StaticFinding[];
    evidenceIds: string[];
  }): Promise<{
    model: string;
    summary: TeacherReportLlmOutput;
  } | null> {
    if (!this.enabled) {
      return null;
    }

    const prompt = this.buildPrompt(input);
    const raw = await this.callModel(prompt);
    const summary = this.parseResponse(raw);
    return {
      model: this.model,
      summary,
    };
  }

  private buildPrompt(input: {
    report: TeacherReport;
    strategyResult: StrategyResult;
    stageResults: StageResult[];
    validationResult: ValidationResult;
    staticFindings: StaticFinding[];
    evidenceIds: string[];
  }): string {
    const payload = JSON.stringify(
      {
        report: {
          detectedProject: input.report.detectedProject,
          strategyApplied: input.report.strategyApplied,
          exactCause: input.report.exactCause,
          evaluationImplication: input.report.evaluationImplication,
        },
        strategyResult: input.strategyResult,
        stageResults: input.stageResults,
        validationResult: input.validationResult,
        staticFindings: input.staticFindings.slice(0, 80),
        evidenceIds: input.evidenceIds.slice(0, 80),
      },
      null,
      2,
    ).slice(0, this.maxInputChars);

    return [
      'Eres un asistente de apoyo docente para evaluación técnica de prácticas Python.',
      'No decidas resultado técnico: solo reformula lo ya decidido en lenguaje natural.',
      '',
      'Devuelve SOLO JSON UTF-8 válido, sin markdown, con esta forma exacta:',
      '{',
      '  "findingsForTeachers": "string",',
      '  "evidenceReadableText": "string",',
      '  "naturalExplanation": "string",',
      '  "humanInterpretation": "string",',
      '  "classificationSupport": "string",',
      '  "staticFindingsSupport": "string",',
      '  "strategySupport": "string",',
      '  "validationSupport": "string"',
      '}',
      '',
      'Reglas:',
      '- No inventes datos no presentes en la entrada.',
      '- No cambies verdicts técnicos PASS/FAIL/SKIP.',
      '- Redacción clara para profesorado (español, tono académico).',
      '',
      'Entrada técnica:',
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
        throw new Error('Respuesta de modelo sin campo response string.');
      }
      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout agotado al generar resumen docente.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(raw: string): TeacherReportLlmOutput {
    const normalized = this.stripCodeFence(raw).trim();
    if (!normalized) {
      throw new Error('Salida vacía del modelo para resumen docente.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      throw new Error('La salida del modelo no es JSON válido.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El JSON del modelo no tiene formato objeto.');
    }

    const object = parsed as Record<string, unknown>;
    const requiredKeys = [
      'findingsForTeachers',
      'evidenceReadableText',
      'naturalExplanation',
      'humanInterpretation',
      'classificationSupport',
      'staticFindingsSupport',
      'strategySupport',
      'validationSupport',
    ];
    for (const key of requiredKeys) {
      if (typeof object[key] !== 'string') {
        throw new Error(`Clave inválida en salida LLM: ${key}.`);
      }
    }

    return {
      findingsForTeachers: String(object.findingsForTeachers).trim(),
      evidenceReadableText: String(object.evidenceReadableText).trim(),
      naturalExplanation: String(object.naturalExplanation).trim(),
      humanInterpretation: String(object.humanInterpretation).trim(),
      classificationSupport: String(object.classificationSupport).trim(),
      staticFindingsSupport: String(object.staticFindingsSupport).trim(),
      strategySupport: String(object.strategySupport).trim(),
      validationSupport: String(object.validationSupport).trim(),
    };
  }

  private stripCodeFence(value: string): string {
    const trimmed = value.trim();
    if (!trimmed.startsWith('```')) {
      return trimmed;
    }
    return trimmed
      .replace(/^```[a-zA-Z]*\s*/u, '')
      .replace(/```$/u, '')
      .trim();
  }

  private toBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['true', '1', 'yes', 'y', 'on'].includes(
      String(value).toLowerCase(),
    );
  }
}
