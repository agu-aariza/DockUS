import { ConfigService } from '@nestjs/config';
import { BuilderLlmAssessment, StageStatus } from '../builder.types';
import { BuilderEvaluationLlmService } from './builder-evaluation-llm.service';

const buildAssessment = (
  overrides: Partial<BuilderLlmAssessment> = {},
): BuilderLlmAssessment => ({
  structuralType: 'Web API con FastAPI',
  capabilities: {
    C1: { status: 'yes', rationale: 'Instalable.' },
    C2: { status: 'yes', rationale: 'Ejecutable.' },
    C3: { status: 'yes', rationale: 'Servicio HTTP.' },
    C4: { status: 'yes', rationale: 'Tests ejecutados.' },
    C5: { status: 'yes', rationale: 'Healthcheck ejecutado.' },
    C6: { status: 'no', rationale: 'Sin configuración externa.' },
  },
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'La evidencia confirma un servicio web funcional.',
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
  evidenceSummary: 'La construcción, despliegue, healthcheck y tests pasaron.',
  observedEvidence: ['BUILD=PASS', 'DEPLOY=PASS', 'TESTS=PASS'],
  evaluationLimits: [],
  ...overrides,
});

describe('BuilderEvaluationLlmService', () => {
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
  });

  it('acepta una evaluación final válida', async () => {
    const service = new BuilderEvaluationLlmService(configService);
    mockFetchJson(buildAssessment());

    const result = await service.evaluate({
      planningAssessment: buildAssessment({ evaluativeState: 'E2' }),
      stageResults: [
        {
          stage: 'BUILD' as never,
          status: StageStatus.PASS,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          reasonCode: 'BUILD_OK',
          evidenceRefs: [],
        },
      ],
      staticFindings: [],
      staticReviewIssues: [],
      warnings: [],
      executionContext: {
        pythonBaseImage: 'python:3.11.9-slim-bookworm',
        pythonBaseImageDigest: null,
        dockerVersion: 'Docker version 27',
        runtimeBackend: 'docker-cli',
        sandboxRuntime: 'runc',
        limits: {
          batchTimeoutSeconds: 60,
          serviceReadyTimeoutSeconds: 90,
          stabilityWindowSeconds: 30,
        },
      },
      evidenceArtifacts: [],
      observedEvidence: { build: 'pass' },
    });

    expect(result?.assessment.evaluativeState).toBe('E1');
    expect(result?.assessment.capabilities.C5.status).toBe('yes');
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
