import { ConfigService } from '@nestjs/config';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuilderLlmAssessment, RuntimeFile } from '../builder.types';
import { BuilderPlanLlmService } from './builder-plan-llm.service';

const buildAssessment = (
  overrides: Partial<BuilderLlmAssessment> = {},
): BuilderLlmAssessment => ({
  structuralType: 'Web API con FastAPI',
  capabilities: {
    C1: { status: 'yes', rationale: 'Instalable.' },
    C2: { status: 'yes', rationale: 'Ejecutable.' },
    C3: { status: 'yes', rationale: 'Desplegable como servicio.' },
    C4: { status: 'yes', rationale: 'Tiene tests.' },
    C5: { status: 'yes', rationale: 'Healthcheck disponible.' },
    C6: { status: 'no', rationale: 'No requiere configuración externa.' },
  },
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'Proyecto de servicio web bien definido.',
  externalRequirements: [],
  recipe: {
    install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
    run: [
      'python',
      '-m',
      'uvicorn',
      'app:app',
      '--host',
      '0.0.0.0',
      '--port',
      '8000',
    ],
    test: [['python', '-m', 'pytest', '-q']],
    healthcheck: ['python', 'healthcheck.py'],
    servicePort: 8000,
    systemPackages: [],
  },
  evidenceSummary: 'Se detectan manifiestos y archivos de servicio.',
  observedEvidence: ['requirements.txt presente', 'app.py presente'],
  evaluationLimits: [],
  ...overrides,
});

describe('BuilderPlanLlmService', () => {
  let service: BuilderPlanLlmService;
  let runtimeFiles: RuntimeFile[];
  let tempDir: string;

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
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'builder-plan-spec-'));
    writeFileSync(
      path.join(tempDir, 'app.py'),
      'from fastapi import FastAPI\napp = FastAPI()\n',
      'utf8',
    );
    writeFileSync(
      path.join(tempDir, 'requirements.txt'),
      'fastapi\nuvicorn\n',
      'utf8',
    );
    runtimeFiles = [
      {
        relativePath: 'app.py',
        absolutePath: path.join(tempDir, 'app.py'),
        sizeBytes: 40,
      },
      {
        relativePath: 'requirements.txt',
        absolutePath: path.join(tempDir, 'requirements.txt'),
        sizeBytes: 17,
      },
    ];
    service = new BuilderPlanLlmService(configService);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('acepta una salida válida del planner', async () => {
    mockFetchJson(buildAssessment());

    const result = await service.generatePlan({
      projectRootDir: tempDir,
      runtimeFiles,
      staticFindings: [],
    });

    expect(result?.assessment.structuralType).toBe('Web API con FastAPI');
    expect(result?.assessment.recipe.servicePort).toBe(8000);
    expect(result?.model).toBe('dockus-builder-plan');
  });

  it('rechaza una salida incompleta', async () => {
    const invalid = buildAssessment();
    delete (invalid.capabilities as Partial<typeof invalid.capabilities>).C4;
    mockFetchJson(invalid);

    await expect(
      service.generatePlan({
        projectRootDir: tempDir,
        runtimeFiles,
        staticFindings: [],
      }),
    ).rejects.toThrow(/capabilities\.C4/i);
  });

  it('rechaza comandos inseguros', async () => {
    mockFetchJson(
      buildAssessment({
        recipe: {
          ...buildAssessment().recipe,
          run: ['bash', '-lc', 'uvicorn app:app'],
        },
      }),
    );

    await expect(
      service.generatePlan({
        projectRootDir: tempDir,
        runtimeFiles,
        staticFindings: [],
      }),
    ).rejects.toThrow(/Executable no permitido/i);
  });

  it('rechaza puertos inválidos', async () => {
    mockFetchJson(
      buildAssessment({
        recipe: {
          ...buildAssessment().recipe,
          servicePort: 70000,
        },
      }),
    );

    await expect(
      service.generatePlan({
        projectRootDir: tempDir,
        runtimeFiles,
        staticFindings: [],
      }),
    ).rejects.toThrow(/servicePort/i);
  });



  it.each([
    ['Script de Análisis de Datos', 'E2'],
    ['Web API con FastAPI', 'E1'],
    ['Worker/batch job', 'E2'],
  ] as const)(
    'acepta un escenario representativo %s',
    async (structuralType, evaluativeState) => {
      const recipe =
        structuralType === 'Worker/batch job'
          ? {
              ...buildAssessment().recipe,
              healthcheck: null,
              servicePort: null,
            }
          : buildAssessment().recipe;
      const capabilities: BuilderLlmAssessment['capabilities'] =
        structuralType === 'Worker/batch job'
          ? {
              ...buildAssessment().capabilities,
              C3: { status: 'no', rationale: 'Job efímero, no servicio.' },
              C5: {
                status: 'no',
                rationale: 'No aplica healthcheck de servicio.',
              },
            }
          : buildAssessment().capabilities;

      mockFetchJson(
        buildAssessment({
          structuralType,
          evaluativeState,
          recipe,
          capabilities,
        }),
      );

      const result = await service.generatePlan({
        projectRootDir: tempDir,
        runtimeFiles,
        staticFindings: [],
      });

      expect(result?.assessment.structuralType).toBe(structuralType);
      expect(result?.assessment.evaluativeState).toBe(evaluativeState);
    },
  );

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
