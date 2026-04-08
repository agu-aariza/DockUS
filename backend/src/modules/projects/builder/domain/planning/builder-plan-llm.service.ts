import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  BuilderLlmPhaseResult,
  RuntimeFile,
  StaticFinding,
} from '../builder.types';
import { parseBuilderLlmAssessment } from '../llm/builder-llm-assessment.parser';
import {
  readTextFileSafe,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';

const SNIPPET_PRIORITY_NAMES = new Set([
  '__main__.py',
  'app.py',
  'asgi.py',
  'cli.py',
  'main.py',
  'manage.py',
  'pyproject.toml',
  'requirements-dev.txt',
  'requirements.txt',
  'runtime.txt',
  'server.py',
  'setup.cfg',
  'setup.py',
  'tox.ini',
  'wsgi.py',
]);

@Injectable()
export class BuilderPlanLlmService {
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
      'qwen2.5-coder:32b',
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

  async generatePlan(input: {
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
  }): Promise<BuilderLlmPhaseResult | null> {
    if (!this.enabled) {
      return null;
    }

    const prompt = await this.buildPrompt(input);
    const raw = await this.callModel(prompt);
    return {
      model: this.model,
      assessment: this.parseResponse(raw),
    };
  }

  private async buildPrompt(input: {
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
  }): Promise<string> {
    const workspaceSnapshot = await this.buildWorkspaceSnapshot(input);

    return [
      'Eres el planner principal del builder Python de DockUS.',
      'Debes clasificar el proyecto usando exclusivamente hechos observables del workspace y devolver una receta ejecutable para contenedor Linux slim.',
      '',
      'Taxonomía estructural:',
      '- T1: Script standalone',
      '- T2: CLI application',
      '- T3: Python package/library',
      '- T4: Web API ligera (Flask/FastAPI)',
      '- T5: Web app estructurada (Django)',
      '- T6: Worker/batch job',
      '- T7: Ambiguo o híbrido',
      '- T8: No clasificable',
      '',
      'Capacidades:',
      '- C1 instalable',
      '- C2 ejecutable',
      '- C3 desplegable como servicio',
      '- C4 testeable',
      '- C5 observable con healthcheck',
      '- C6 requiere intervención/configuración externa',
      '',
      'Estado evaluativo:',
      '- E1 evaluación completa posible',
      '- E2 evaluación parcial posible',
      '- E3 solo análisis estático viable',
      '- E4 evaluación bloqueada por defectos graves',
      '',
      'Devuelve SOLO JSON UTF-8 válido, sin markdown, con esta forma exacta:',
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
      'Reglas obligatorias:',
      '- Usa solo ejecutables permitidos: python, python3, pip, pip3, pytest, poetry, uv, pipenv, hatch, pdm, flask, uvicorn, gunicorn, streamlit, tox, coverage.',
      '- No uses bash, sh, pipes, redirecciones ni subshells.',
      '- Los comandos deben ser arrays de tokens seguros.',
      '- Si C3=yes en T4/T5, proporciona run y servicePort.',
      '- Si C5=yes, proporciona healthcheck.',
      '- T6 debe comportarse como job efímero, no como servicio persistente.',
      '- T7 no puede terminar en E1.',
      '- T8 debe terminar en E4.',
      '- Si no hay suficiente evidencia para ejecutar con seguridad, usa run=null y un estado evaluativo conservador.',
      '',
      'Hechos observables del workspace:',
      workspaceSnapshot,
    ].join('\n');
  }

  private async buildWorkspaceSnapshot(input: {
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
  }): Promise<string> {
    const fileList = input.runtimeFiles
      .map((file) => toPosixPath(file.relativePath))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 200);
    const snippets = await this.collectRelevantSnippets(input.runtimeFiles);
    const directoryHistogram = this.buildDirectoryHistogram(fileList);
    const pythonFiles = fileList.filter((file) => file.endsWith('.py'));
    const testFiles = fileList.filter(
      (file) =>
        file.startsWith('tests/') ||
        file.includes('/tests/') ||
        file.endsWith('_test.py') ||
        file.endsWith('_tests.py') ||
        file.startsWith('test_') ||
        file.includes('/test_'),
    );

    const payload = {
      summary: {
        totalFiles: fileList.length,
        pythonFileCount: pythonFiles.length,
        testFileCount: testFiles.length,
        topDirectories: directoryHistogram,
      },
      manifests: {
        requirements: fileList.filter((file) =>
          /(^|\/)requirements[^/]*\.txt$/u.test(file),
        ),
        pyprojectToml: fileList.filter((file) =>
          file.endsWith('pyproject.toml'),
        ),
        setupPy: fileList.filter((file) => file.endsWith('setup.py')),
        setupCfg: fileList.filter((file) => file.endsWith('setup.cfg')),
        runtimeTxt: fileList.filter((file) => file.endsWith('runtime.txt')),
        managePy: fileList.filter((file) => file.endsWith('manage.py')),
        procfile: fileList.filter((file) => file.endsWith('Procfile')),
        dockerfile: fileList.filter((file) => /(^|\/)Dockerfile$/u.test(file)),
      },
      visibleSignals: {
        serviceLikeFiles: fileList.filter((file) =>
          /(app|main|server|wsgi|asgi)\.py$/u.test(file),
        ),
        cliLikeFiles: fileList.filter((file) =>
          /(cli|main|__main__)\.py$/u.test(file),
        ),
        workerLikeFiles: fileList.filter((file) =>
          /(worker|job|tasks|celery|queue)\.py$/u.test(file),
        ),
      },
      staticFindings: input.staticFindings.slice(0, 20),
      fileList,
      snippets,
    };

    return JSON.stringify(payload, null, 2).slice(0, this.maxInputChars);
  }

  private buildDirectoryHistogram(fileList: string[]): Array<{
    path: string;
    count: number;
  }> {
    const counts = new Map<string, number>();

    for (const file of fileList) {
      const segments = file.split('/');
      const root = segments.length > 1 ? segments[0] : '.';
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([dir, count]) => ({ path: dir, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
      .slice(0, 20);
  }

  private async collectRelevantSnippets(
    runtimeFiles: RuntimeFile[],
  ): Promise<Array<{ path: string; content: string }>> {
    const prioritized = [...runtimeFiles].sort((a, b) => {
      const scoreDelta =
        this.scoreSnippetCandidate(b.relativePath) -
        this.scoreSnippetCandidate(a.relativePath);
      return scoreDelta !== 0
        ? scoreDelta
        : a.relativePath.localeCompare(b.relativePath);
    });

    const snippets: Array<{ path: string; content: string }> = [];
    let budget = Math.max(this.maxInputChars - 8000, 8000);

    for (const file of prioritized) {
      if (budget <= 0 || snippets.length >= 16) {
        break;
      }

      const content = await readTextFileSafe(file.absolutePath);
      if (!content.trim()) {
        continue;
      }

      const trimmed = content.slice(0, 2400);
      snippets.push({
        path: toPosixPath(file.relativePath),
        content: trimmed,
      });
      budget -= trimmed.length;
    }

    return snippets;
  }

  private scoreSnippetCandidate(relativePath: string): number {
    const normalized = toPosixPath(relativePath).toLowerCase();
    const baseName = normalized.split('/').at(-1) ?? normalized;
    let score = 0;

    if (SNIPPET_PRIORITY_NAMES.has(baseName)) {
      score += 50;
    }
    if (normalized.endsWith('.toml') || normalized.endsWith('.txt')) {
      score += 25;
    }
    if (normalized.includes('/tests/') || normalized.startsWith('tests/')) {
      score += 15;
    }
    if (
      normalized.endsWith('.py') &&
      ['app', 'main', 'server', 'run', 'manage', 'cli'].some((token) =>
        baseName.includes(token),
      )
    ) {
      score += 30;
    }
    if (normalized.endsWith('.py')) {
      score += 10;
    }

    return score;
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
        throw new Error('Respuesta de planner LLM sin campo response string.');
      }

      return payload.response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout agotado al planificar builder con LLM.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(raw: string): BuilderLlmPhaseResult['assessment'] {
    return parseBuilderLlmAssessment(raw, { mode: 'planning' });
  }
}
