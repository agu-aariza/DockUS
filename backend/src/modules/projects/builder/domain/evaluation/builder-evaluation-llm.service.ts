import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  ASSESSMENTS,
  BuilderLlmAssessment,
  BuilderLlmPhaseResult,
  CAPABILITY_IDS,
  CONFIDENCE_LEVELS,
  EVALUATIVE_STATES,
  ExecutionContext,
  StageResult,
  StaticFinding,
  STRUCTURAL_TYPES,
} from '../builder.types';
import { toPosixPath } from '../../infrastructure/utils/builder-analysis.util';

const ALLOWED_EXECUTABLES = new Set([
  'coverage',
  'flask',
  'gunicorn',
  'hatch',
  'pdm',
  'pip',
  'pip3',
  'pipenv',
  'poetry',
  'pytest',
  'python',
  'python3',
  'streamlit',
  'tox',
  'uv',
  'uvicorn',
]);

const SHELL_WRAPPER_TOKENS = new Set(['|', '||', '&&', ';', '>', '>>', '<']);

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
        'BUILDER_LLM_BUILDER_ENABLED',
        true,
      ),
    );
    this.baseUrl = this.configService.get<string>(
      'BUILDER_OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_MODEL',
      'qwen2.5-coder:32b',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_EVALUATION_MAX_INPUT_CHARS',
      this.configService.get<number>(
        'BUILDER_LLM_BUILDER_MAX_INPUT_CHARS',
        35000,
      ),
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

  private parseResponse(raw: string): BuilderLlmAssessment {
    const normalized = this.stripCodeFence(raw).trim();
    if (!normalized) {
      throw new Error('Salida vacía del evaluador LLM.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      throw new Error('La salida del evaluador LLM no es JSON válido.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El evaluador LLM devolvió un JSON no objeto.');
    }

    const object = parsed as Record<string, unknown>;
    const assessment: BuilderLlmAssessment = {
      structuralType: this.normalizeStructuralType(object.structuralType),
      capabilities: this.normalizeCapabilities(object.capabilities),
      evaluativeState: this.normalizeEvaluativeState(object.evaluativeState),
      confidence: this.normalizeConfidence(object.confidence),
      rationale: this.normalizeString(object.rationale, 'rationale'),
      externalRequirements: this.normalizeStringArray(
        object.externalRequirements,
        'externalRequirements',
      ),
      recipe: this.normalizeRecipe(object.recipe),
      evidenceSummary: this.normalizeString(
        object.evidenceSummary,
        'evidenceSummary',
      ),
      observedEvidence: this.normalizeStringArray(
        object.observedEvidence,
        'observedEvidence',
      ),
      evaluationLimits: this.normalizeStringArray(
        object.evaluationLimits,
        'evaluationLimits',
      ),
    };

    this.assertSemanticConsistency(assessment);
    return assessment;
  }

  private normalizeCapabilities(
    value: unknown,
  ): BuilderLlmAssessment['capabilities'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('capabilities debe ser un objeto.');
    }

    const object = value as Record<string, unknown>;
    const capabilities = {} as BuilderLlmAssessment['capabilities'];

    for (const capabilityId of CAPABILITY_IDS) {
      const rawCapability = object[capabilityId];
      if (
        !rawCapability ||
        typeof rawCapability !== 'object' ||
        Array.isArray(rawCapability)
      ) {
        throw new Error(`capabilities.${capabilityId} debe ser un objeto.`);
      }

      const capability = rawCapability as Record<string, unknown>;
      const status = this.normalizeString(
        capability.status,
        `capabilities.${capabilityId}.status`,
      );
      if (!ASSESSMENTS.includes(status as (typeof ASSESSMENTS)[number])) {
        throw new Error(`Estado inválido en ${capabilityId}.`);
      }

      capabilities[capabilityId] = {
        status: status as BuilderLlmAssessment['capabilities']['C1']['status'],
        rationale: this.normalizeString(
          capability.rationale,
          `capabilities.${capabilityId}.rationale`,
        ),
      };
    }

    return capabilities;
  }

  private normalizeRecipe(value: unknown): BuilderLlmAssessment['recipe'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('recipe debe ser un objeto.');
    }

    const object = value as Record<string, unknown>;

    return {
      install: this.normalizeCommandMatrix(object.install, 'recipe.install'),
      run:
        object.run === null || object.run === undefined
          ? null
          : this.normalizeCommand(object.run, 'recipe.run'),
      test: this.normalizeCommandMatrix(object.test, 'recipe.test'),
      healthcheck:
        object.healthcheck === null || object.healthcheck === undefined
          ? null
          : this.normalizeCommand(object.healthcheck, 'recipe.healthcheck'),
      servicePort:
        object.servicePort === null || object.servicePort === undefined
          ? null
          : this.normalizePort(object.servicePort, 'recipe.servicePort'),
      systemPackages: this.normalizeSystemPackages(object.systemPackages),
    };
  }

  private assertSemanticConsistency(assessment: BuilderLlmAssessment): void {
    if (
      assessment.structuralType === 'T8' &&
      assessment.evaluativeState !== 'E4'
    ) {
      throw new Error('T8 debe evaluar en E4.');
    }

    if (
      assessment.structuralType === 'T7' &&
      assessment.evaluativeState === 'E1'
    ) {
      throw new Error('T7 no puede evaluarse como E1.');
    }

    if (
      assessment.capabilities.C3.status === 'yes' &&
      ['T4', 'T5'].includes(assessment.structuralType) &&
      assessment.recipe.run === null
    ) {
      throw new Error('T4/T5 con C3=yes requieren recipe.run.');
    }

    if (
      assessment.capabilities.C3.status === 'yes' &&
      assessment.recipe.servicePort === null
    ) {
      throw new Error('C3=yes requiere recipe.servicePort.');
    }

    if (
      assessment.capabilities.C5.status === 'yes' &&
      assessment.recipe.healthcheck === null
    ) {
      throw new Error('C5=yes requiere recipe.healthcheck.');
    }
  }

  private normalizeStructuralType(value: unknown) {
    const normalized = this.normalizeString(value, 'structuralType');
    if (
      !STRUCTURAL_TYPES.includes(
        normalized as (typeof STRUCTURAL_TYPES)[number],
      )
    ) {
      throw new Error('structuralType inválido en evaluador LLM.');
    }
    return normalized as BuilderLlmAssessment['structuralType'];
  }

  private normalizeEvaluativeState(value: unknown) {
    const normalized = this.normalizeString(value, 'evaluativeState');
    if (
      !EVALUATIVE_STATES.includes(
        normalized as (typeof EVALUATIVE_STATES)[number],
      )
    ) {
      throw new Error('evaluativeState inválido en evaluador LLM.');
    }
    return normalized as BuilderLlmAssessment['evaluativeState'];
  }

  private normalizeConfidence(value: unknown) {
    const normalized = this.normalizeString(value, 'confidence');
    if (
      !CONFIDENCE_LEVELS.includes(
        normalized as (typeof CONFIDENCE_LEVELS)[number],
      )
    ) {
      throw new Error('confidence inválido en evaluador LLM.');
    }
    return normalized as BuilderLlmAssessment['confidence'];
  }

  private normalizeSystemPackages(value: unknown): string[] {
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error('recipe.systemPackages debe ser un array.');
    }

    return value.map((entry, index) => {
      const pkg = this.normalizeString(
        entry,
        `recipe.systemPackages[${index}]`,
      );
      if (!/^[a-z0-9.+-]+$/i.test(pkg)) {
        throw new Error(`Paquete de sistema inválido: ${pkg}`);
      }
      return pkg;
    });
  }

  private normalizeCommandMatrix(value: unknown, field: string): string[][] {
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error(`${field} debe ser un array de comandos.`);
    }

    return value.map((command, index) =>
      this.normalizeCommand(command, `${field}[${index}]`),
    );
  }

  private normalizeCommand(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${field} debe ser un array no vacío.`);
    }

    const tokens = value.map((token, index) =>
      this.normalizeString(token, `${field}[${index}]`),
    );
    const executable = tokens[0];
    if (!ALLOWED_EXECUTABLES.has(executable)) {
      throw new Error(`Executable no permitido en ${field}: ${executable}`);
    }

    for (const [index, token] of tokens.entries()) {
      if (/[\n\r`]/.test(token)) {
        throw new Error(`Token inseguro en ${field}: ${token}`);
      }
      if (SHELL_WRAPPER_TOKENS.has(token) || /\$\(.+\)/u.test(token)) {
        throw new Error(`Token de shell no permitido en ${field}: ${token}`);
      }
      if (
        index > 0 &&
        (token.includes('/') || token.endsWith('.py')) &&
        (toPosixPath(token).startsWith('/') ||
          toPosixPath(token).includes('../'))
      ) {
        throw new Error(`Ruta insegura en ${field}: ${token}`);
      }
    }

    return tokens;
  }

  private normalizePort(value: unknown, field: string): number {
    const parsed =
      typeof value === 'number'
        ? value
        : Number.parseInt(this.normalizeString(value, field), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`${field} inválido en evaluador LLM.`);
    }
    return parsed;
  }

  private normalizeStringArray(value: unknown, field: string): string[] {
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new Error(`${field} debe ser un array.`);
    }

    return value.map((entry, index) =>
      this.normalizeString(entry, `${field}[${index}]`),
    );
  }

  private normalizeString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${field} debe ser un string no vacío.`);
    }
    return value.trim();
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
}
