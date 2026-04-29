import {
  BuilderLlmAssessment,
  StageStatus,
  type BuilderTechnicalFeedback,
} from '../builder.types';
import { BuilderReportService } from './builder-report.service';

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
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'Proyecto funcional.',
  externalRequirements: [],
  recipe: {
    install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
    run: ['python', '-m', 'uvicorn', 'app:app'],
    test: [['pytest', '-q']],
    healthcheck: ['python', 'healthcheck.py'],
    servicePort: 8000,
    systemPackages: [],
  },
  evidenceSummary: 'Build y tests correctos.',
  observedEvidence: ['BUILD=PASS'],
  evaluationLimits: [],
  ...overrides,
});

const emptyFeedback: BuilderTechnicalFeedback = {
  security: [],
  architecture: [],
  quality: [],
};

describe('BuilderReportService', () => {
  it('construye outcome, recomendaciones y self-healing', () => {
    const service = new BuilderReportService();
    const report = service.create({
      assessment: buildAssessment(),
      stageResults: [
        {
          stage: 'BUILD' as never,
          status: StageStatus.PASS,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          reasonCode: 'DOCKER_BUILD_OK',
          evidenceRefs: [],
        },
        {
          stage: 'DEPLOY' as never,
          status: StageStatus.PASS,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          reasonCode: 'DEPLOY_SERVICE_READY',
          evidenceRefs: [],
        },
      ],
      relevantEvidence: ['artifact-1'],
      technicalFeedback: {
        ...emptyFeedback,
        quality: [
          {
            title: 'Manejo de errores mejorable',
            detail: 'Añade manejo explícito de excepciones en acceso a DB.',
            severity: 'medium',
            file: 'app.py',
            line: 12,
          },
        ],
      },
      selfHealingTrace: [
        {
          attemptNumber: 1,
          triggerStage: 'BUILD' as never,
          triggerReasonCode: 'DOCKER_BUILD_FAILED',
          triggerSummary: 'Falló la compilación.',
          recipeChanged: true,
          recipeDiff: ['systemPackages'],
          outcome: 'repaired',
          diagnostics: {
            buildLogTail: ['pg_config executable not found'],
            containerLogTail: [],
            errorHints: ['Puede faltar libpq-dev.'],
          },
        },
      ],
    });

    expect(report.overallOutcome).toBe('PASS');
    expect(report.selfHealing.attempted).toBe(true);
    expect(report.selfHealing.recovered).toBe(true);
    expect(report.llmRecommendations).toContain(
      'Añade manejo explícito de excepciones en acceso a DB.',
    );
    expect(report.readableText).toMatch(/Autocorrección:/);
  });

  it('marca FAIL cuando la evaluación queda bloqueada', () => {
    const service = new BuilderReportService();
    const report = service.create({
      assessment: buildAssessment({
        evaluativeState: 'E4',
        evaluationLimits: ['El build no completó.'],
      }),
      stageResults: [
        {
          stage: 'BUILD' as never,
          status: StageStatus.FAIL,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          reasonCode: 'DOCKER_BUILD_FAILED',
          evidenceRefs: [],
        },
      ],
      relevantEvidence: [],
      technicalFeedback: emptyFeedback,
      selfHealingTrace: [],
    });

    expect(report.overallOutcome).toBe('FAIL');
    expect(report.selfHealing.attempted).toBe(false);
  });
});
