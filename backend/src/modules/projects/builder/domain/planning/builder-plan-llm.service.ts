import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as path from 'path';
import { toBoolean } from '../../../../../shared/utils/to-boolean.util';
import {
  BuilderLlmAssessment,
  BuilderLlmPhaseResult,
  BuilderPreflightSummary,
  RuntimeFile,
  StaticFinding,
  AssignmentContext,
} from '../builder.types';
import { parseBuilderLlmAssessment } from '../llm/builder-llm-assessment.parser';
import {
  readTextFileSafe,
  toPosixPath,
} from '../../infrastructure/utils/builder-analysis.util';
import { runCommand } from '../../infrastructure/utils/command-runner.util';

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
  private readonly logger = new Logger(BuilderPlanLlmService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly baseModel: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly systemPrompt: string;

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
    this.baseModel = this.configService.get<string>(
      'BUILDER_OLLAMA_MODEL',
      'qwen2.5-coder:7b',
    );
    this.model = this.configService.get<string>(
      'BUILDER_OLLAMA_PLAN_MODEL',
      'dockus-builder-plan',
    );
    this.timeoutMs = this.configService.get<number>(
      'BUILDER_OLLAMA_TIMEOUT_MS',
      120000,
    );
    this.maxInputChars = this.configService.get<number>(
      'BUILDER_LLM_PLAN_MAX_INPUT_CHARS',
      this.configService.get<number>(
        'BUILDER_LLM_ASSIST_MAX_INPUT_CHARS',
        15000,
      ),
    );
    const promptPath = path.resolve(
      __dirname,
      '../../../../../../scripts/plan-system-prompt.txt',
    );
    this.systemPrompt = readFileSync(promptPath, 'utf-8');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generatePlan(input: {
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
    assignmentContext?: AssignmentContext;
    preflightSummary?: BuilderPreflightSummary;
  }): Promise<BuilderLlmPhaseResult | null> {
    if (!this.enabled) {
      return null;
    }

    const { systemPrompt, userPrompt, astSkeleton, fileList } =
      await this.buildPrompts(input);

    const fastPathAssessment = this.evaluateFastPath(astSkeleton, fileList);
    if (fastPathAssessment) {
      this.logger.log(
        'Fast-path aplicado exitosamente. Omitiendo LLM planner.',
      );
      return {
        model: 'fast-path-heuristic',
        assessment: fastPathAssessment,
      };
    }

    const { response, model } = await this.callModel(systemPrompt, userPrompt);
    return {
      model,
      assessment: this.parseResponse(response),
    };
  }

  private async buildPrompts(input: {
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
    assignmentContext?: AssignmentContext;
    preflightSummary?: BuilderPreflightSummary;
  }): Promise<{
    systemPrompt: string;
    userPrompt: string;
    astSkeleton: any;
    fileList: string[];
  }> {
    const { payload, astSkeleton, fileList } =
      await this.buildWorkspaceSnapshot(input);
    const assignmentContext = input.assignmentContext ?? {
      expectedType: null,
      rubricInstructions: null,
    };

    const userPrompt = [
      'Expectativas del Profesor:',
      `- Tipo de proyecto esperado: ${assignmentContext.expectedType || 'No especificado'}`,
      `- Instrucciones de la Rúbrica: ${assignmentContext.rubricInstructions || 'No especificadas'}`,
      '',
      'Preflight capability-first:',
      input.preflightSummary
        ? JSON.stringify(
            {
              compatibility: input.preflightSummary.compatibility,
              supportedProjectType: input.preflightSummary.supportedProjectType,
              executionProfile: input.preflightSummary.executionProfile,
              dependencyManager: input.preflightSummary.dependencyManager,
              workingDirectory: input.preflightSummary.workingDirectory,
              manifestSource: input.preflightSummary.manifestSource,
              manifestPath: input.preflightSummary.manifestPath,
              entrypointCandidates: input.preflightSummary.entrypointCandidates,
              resolvedCommands: input.preflightSummary.resolvedCommands,
            },
            null,
            2,
          )
        : 'Sin preflight adicional.',
      '',
      'Hechos observables del workspace:',
      payload,
    ].join('\n');

    return {
      systemPrompt: this.systemPrompt,
      userPrompt,
      astSkeleton,
      fileList,
    };
  }

  private async buildWorkspaceSnapshot(input: {
    projectRootDir: string;
    runtimeFiles: RuntimeFile[];
    staticFindings: StaticFinding[];
  }): Promise<{ payload: string; astSkeleton: any; fileList: string[] }> {
    let astSkeleton = null;
    try {
      const scriptPath = path.resolve(
        __dirname,
        '../../../../../../../scripts/ast_analyzer.py',
      );
      const result = await runCommand(
        'python3',
        [scriptPath, input.projectRootDir],
        {
          timeoutMs: 15000,
          maxBufferedChars: 1_500_000,
        },
      );
      if (result.exitCode === 0 && result.stdout.trim()) {
        astSkeleton = JSON.parse(result.stdout);

        // Auto-Generate requirements.txt if no manifests exist
        const hasManifest = input.runtimeFiles.some(
          (f) =>
            f.relativePath.includes('requirements.txt') ||
            f.relativePath.endsWith('pyproject.toml') ||
            f.relativePath.endsWith('setup.py'),
        );

        if (!hasManifest) {
          const allImports = new Set<string>();
          const astEntries =
            astSkeleton && typeof astSkeleton === 'object'
              ? Object.values(
                  astSkeleton as Record<
                    string,
                    { external_imports?: string[] }
                  >,
                )
              : [];

          for (const fileAnalysis of astEntries) {
            if (
              fileAnalysis.external_imports &&
              Array.isArray(fileAnalysis.external_imports)
            ) {
              for (const imp of fileAnalysis.external_imports) {
                allImports.add(imp);
              }
            }
          }
          if (allImports.size > 0) {
            const reqContent = Array.from(allImports).join('\n') + '\n';
            const reqPath = path.join(input.projectRootDir, 'requirements.txt');
            await require('fs/promises').writeFile(reqPath, reqContent);
            input.runtimeFiles.push({
              relativePath: 'requirements.txt',
              absolutePath: reqPath,
              sizeBytes: reqContent.length,
            });
            this.logger.log(
              `Auto-generado requirements.txt con: ${Array.from(allImports).join(', ')}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo ejecutar ast_analyzer.py: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
      ...(astSkeleton ? { astSkeleton } : {}),
    };

    return {
      payload: JSON.stringify(payload, null, 2).slice(0, this.maxInputChars),
      astSkeleton,
      fileList,
    };
  }

  private evaluateFastPath(
    astSkeleton: any,
    fileList: string[],
  ): BuilderLlmAssessment | null {
    if (!astSkeleton) return null;

    let hasDjango = false;
    let hasFastAPI = false;
    let hasFlask = false;
    let hasStreamlit = false;

    for (const analysis of Object.values(astSkeleton)) {
      const external = (analysis as any).external_imports || [];
      if (external.includes('django')) hasDjango = true;
      if (external.includes('fastapi')) hasFastAPI = true;
      if (external.includes('flask')) hasFlask = true;
      if (external.includes('streamlit')) hasStreamlit = true;
    }

    let recipeRun: string[] | null = null;
    let structuralType: BuilderLlmAssessment['structuralType'] = 'T6';
    let servicePort = 8000;

    if (fileList.includes('manage.py')) {
      recipeRun = ['python', 'manage.py', 'runserver', '0.0.0.0:8000'];
      structuralType = 'T4';
      servicePort = 8000;
    } else if (hasFastAPI) {
      const appFile = fileList.find(
        (f) =>
          f.endsWith('main.py') || f.endsWith('app.py') || f.endsWith('api.py'),
      );
      if (appFile) {
        const moduleName = appFile.replace('.py', '');
        recipeRun = [
          'uvicorn',
          `${moduleName}:app`,
          '--host',
          '0.0.0.0',
          '--port',
          '8000',
        ];
        structuralType = 'T4';
        servicePort = 8000;
      }
    } else if (hasFlask) {
      const appFile = fileList.find(
        (f) => f.endsWith('app.py') || f.endsWith('main.py'),
      );
      if (appFile) {
        const moduleName = appFile.replace('.py', '');
        recipeRun = ['gunicorn', `${moduleName}:app`, '--bind', '0.0.0.0:5000'];
        structuralType = 'T4';
        servicePort = 5000;
      }
    } else if (hasStreamlit) {
      const appFile = fileList.find(
        (f) => f.endsWith('app.py') || f.endsWith('main.py'),
      );
      if (appFile) {
        recipeRun = [
          'streamlit',
          'run',
          appFile,
          '--server.port',
          '8501',
          '--server.address',
          '0.0.0.0',
        ];
        structuralType = 'T5';
        servicePort = 8501;
      }
    } else {
      const mainScript = fileList.find(
        (f) => f.endsWith('main.py') || f.endsWith('script.py'),
      );
      if (mainScript) {
        recipeRun = ['python', mainScript];
        structuralType = 'T6';
      }
    }

    if (!recipeRun) return null;

    const isService = structuralType === 'T4' || structuralType === 'T5';

    return {
      structuralType,
      capabilities: {
        C1: {
          status: 'yes',
          rationale: 'Fast-Path: Dependencias auto-gestionadas por heurística.',
        },
        C2: {
          status: 'yes',
          rationale: 'Fast-Path: Receta generada determinísticamente.',
        },
        C3: {
          status: isService ? 'yes' : 'no',
          rationale: isService
            ? 'Fast-Path: Framework persistente.'
            : 'Fast-Path: Script efímero.',
        },
        C4: { status: 'unknown', rationale: 'Pruebas no configuradas.' },
        C5: {
          status: 'no',
          rationale: 'Healthcheck no inyectado por defecto.',
        },
        C6: {
          status: 'unknown',
          rationale: 'Sin análisis avanzado de variables.',
        },
      },
      evaluativeState: isService ? 'E3' : 'E4',
      confidence: 'high',
      rationale: 'Generado instantáneamente vía Motor Heurístico Fast-Path.',
      externalRequirements: [],
      recipe: {
        install: [['pip', 'install', '-r', 'requirements.txt']],
        run: recipeRun,
        test: [],
        healthcheck: null,
        servicePort: isService ? servicePort : null,
        systemPackages: [],
      },
      evidenceSummary: 'Patrones arquitectónicos detectados vía AST.',
      observedEvidence: [
        'Framework detectado en los external_imports del AST.',
      ],
      evaluationLimits: [],
    };
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

  private async callModel(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ response: string; model: string }> {
    try {
      const response = await this.callSpecificModel(this.model, userPrompt);
      return {
        response,
        model: this.model,
      };
    } catch (error) {
      if (this.model === this.baseModel) {
        throw error;
      }
      this.logger.warn(
        `Falló el modelo planner ${this.model}; se usará fallback ${this.baseModel}: ${error instanceof Error ? error.message : 'error no tipado'}`,
      );
      const response = await this.callSpecificModel(
        this.baseModel,
        userPrompt,
        systemPrompt,
      );
      return {
        response,
        model: this.baseModel,
      };
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
