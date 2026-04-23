import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuilderLlmAssessment, RuntimeFile } from '../builder.types';
import { BuilderRepairLlmService } from './builder-repair-llm.service';

const buildAssessment = (
  overrides: Partial<BuilderLlmAssessment> = {},
): BuilderLlmAssessment => ({
  structuralType: 'Web API con FastAPI',
  capabilities: {
    C1: { status: 'yes', rationale: 'Instalable.' },
    C2: { status: 'yes', rationale: 'Ejecutable.' },
    C3: { status: 'yes', rationale: 'Servicio HTTP.' },
    C4: { status: 'yes', rationale: 'Testeable.' },
    C5: { status: 'yes', rationale: 'Healthcheck disponible.' },
    C6: { status: 'no', rationale: 'Sin configuración externa.' },
  },
  evaluativeState: 'E2',
  confidence: 'medium',
  rationale: 'Receta inicial.',
  externalRequirements: [],
  recipe: {
    install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
    run: ['python', '-m', 'uvicorn', 'app:app', '--port', '8000'],
    test: [['pytest', '-q']],
    healthcheck: ['python', 'healthcheck.py'],
    servicePort: 8000,
    systemPackages: [],
  },
  evidenceSummary: 'Resumen inicial.',
  observedEvidence: ['requirements.txt presente'],
  evaluationLimits: [],
  ...overrides,
});

describe('BuilderRepairLlmService', () => {
  let tempDir: string;
  let runtimeFiles: RuntimeFile[];

  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'BUILDER_LLM_ASSIST_ENABLED') {
        return true;
      }
      return defaultValue;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.restoreAllMocks();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'builder-repair-spec-'));
    writeFileSync(path.join(tempDir, 'app.py'), 'print("ok")\n', 'utf8');
    runtimeFiles = [
      {
        relativePath: 'app.py',
        absolutePath: path.join(tempDir, 'app.py'),
        sizeBytes: 12,
      },
    ];
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('acepta una receta corregida compatible con el parser canónico', async () => {
    const service = new BuilderRepairLlmService(configService);
    mockFetchJson(
      buildAssessment({
        recipe: {
          ...buildAssessment().recipe,
          install: [
            ['python', '-m', 'pip', 'install', '-r', 'requirements.txt'],
            ['python', '-m', 'pip', 'install', 'psycopg2-binary'],
          ],
          systemPackages: ['libpq-dev'],
        },
      }),
    );

    const result = await service.repair({
      projectRootDir: tempDir,
      runtimeFiles,
      assessment: buildAssessment(),
      staticFindings: [],
      staticReviewIssues: [],
      failureStage: 'BUILD' as never,
      failureReasonCode: 'DOCKER_BUILD_FAILED',
      buildLogText: 'pg_config executable not found',
      podLogs: null,
      podDescribe: null,
      kubernetesEvents: null,
      priorRepairAttempts: 0,
    });

    expect(result?.assessment.recipe.systemPackages).toContain('libpq-dev');
    expect(result?.assessment.recipe.install).toContainEqual([
      'python',
      '-m',
      'pip',
      'install',
      'psycopg2-binary',
    ]);
  });

  function mockFetchJson(payload: unknown): void {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          response: JSON.stringify(payload),
        }),
    }) as unknown as typeof fetch;
  }
});
