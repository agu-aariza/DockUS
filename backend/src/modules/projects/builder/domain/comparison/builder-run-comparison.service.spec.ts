import { ConflictException } from '@nestjs/common';
import { BuilderRunComparisonService } from './builder-run-comparison.service';
import { BuildRun, BuildRunStatus } from '../entities/build-run.entity';
import { BuildStage, StageStatus } from '../builder.types';
import type {
  BuilderLlmAssessment,
  BuilderReport,
  StageResult,
} from '../builder.types';

const buildAssessment = (
  overrides: Partial<BuilderLlmAssessment> = {},
): BuilderLlmAssessment => ({
  structuralType: 'T4',
  capabilities: {
    C1: { status: 'yes', rationale: 'ok' },
    C2: { status: 'yes', rationale: 'ok' },
    C3: { status: 'yes', rationale: 'ok' },
    C4: { status: 'unknown', rationale: 'ok' },
    C5: { status: 'unknown', rationale: 'ok' },
    C6: { status: 'no', rationale: 'ok' },
  },
  evaluativeState: 'E2',
  confidence: 'medium',
  rationale: 'ok',
  externalRequirements: [],
  recipe: {
    install: [['pip', 'install', '-r', 'requirements.txt']],
    run: ['python', 'app.py'],
    test: [],
    healthcheck: null,
    servicePort: 8000,
    systemPackages: [],
  },
  evidenceSummary: 'summary',
  observedEvidence: [],
  evaluationLimits: [],
  ...overrides,
});

const buildStageResult = (
  overrides: Partial<StageResult> = {},
): StageResult => ({
  stage: BuildStage.BUILD,
  status: StageStatus.PASS,
  startedAt: new Date('2026-04-08T19:00:00.000Z').toISOString(),
  finishedAt: new Date('2026-04-08T19:00:02.000Z').toISOString(),
  durationMs: 2000,
  reasonCode: 'BUILD_OK',
  evidenceRefs: [],
  ...overrides,
});

const buildReport = (): BuilderReport => ({
  ...buildAssessment(),
  readableText: 'report',
  stageOutcome: {
    ANALYSIS: StageStatus.PASS,
    BUILD: StageStatus.PASS,
    DEPLOY: StageStatus.PASS,
    PROBES: StageStatus.PASS,
    STABILITY: StageStatus.PASS,
    TESTS: StageStatus.SKIP,
    CLEANUP: StageStatus.PASS,
  },
  relevantEvidence: ['artifact-a'],
});

const buildRun = (overrides: Partial<BuildRun> = {}): BuildRun =>
  ({
    id: 'run-a',
    deliveryId: 'delivery-1',
    delivery: undefined as unknown as BuildRun['delivery'],
    triggeredById: 'teacher-1',
    triggeredBy: undefined as unknown as BuildRun['triggeredBy'],
    runKind: 'STANDARD',
    sourceRunId: null,
    status: BuildRunStatus.SUCCESS,
    activeStage: null,
    latestEventSequence: '4',
    stackResult: null,
    dockerfileContent: 'FROM python:3.11-slim',
    buildLogs: null,
    timingsMs: null,
    staticFindings: [],
    stageResults: [buildStageResult()],
    llmAssessment: buildAssessment(),
    report: buildReport(),
    evidenceArtifacts: [],
    executionContext: {
      pythonBaseImage: 'python:3.11-slim',
      pythonBaseImageDigest: null,
      dockerVersion: 'Docker 27',
      kindVersion: 'kind 0.24',
      kubectlVersion: 'kubectl 1.31',
      clusterName: 'dockus',
      limits: {
        batchTimeoutSeconds: 60,
        serviceReadyTimeoutSeconds: 90,
        stabilityWindowSeconds: 30,
      },
    },
    reproducibilitySnapshot: null,
    reproducibilityResult: null,
    failureReason: null,
    warnings: [],
    imageTag: null,
    imageExpiresAt: null,
    startedAt: new Date('2026-04-08T19:00:00.000Z'),
    finishedAt: new Date('2026-04-08T19:00:02.000Z'),
    artifacts: [],
    events: [],
    createdAt: new Date('2026-04-08T19:00:00.000Z'),
    updatedAt: new Date('2026-04-08T19:00:02.000Z'),
    ...overrides,
  }) as BuildRun;

describe('BuilderRunComparisonService', () => {
  const service = new BuilderRunComparisonService();

  it('marca IMPROVED cuando el candidato mejora el estado evaluativo', () => {
    const comparison = service.compare(
      buildRun(),
      buildRun({
        id: 'run-b',
        llmAssessment: buildAssessment({
          evaluativeState: 'E1',
          confidence: 'high',
          capabilities: {
            ...buildAssessment().capabilities,
            C5: { status: 'yes', rationale: 'healthcheck estable' },
          },
        }),
      }),
    );

    expect(comparison.overallVerdict).toBe('IMPROVED');
    expect(comparison.evaluativeStateDelta).toEqual({
      base: 'E2',
      candidate: 'E1',
    });
  });

  it('marca REGRESSED cuando aparecen hallazgos y falla una etapa', () => {
    const comparison = service.compare(
      buildRun(),
      buildRun({
        id: 'run-c',
        stageResults: [
          buildStageResult({
            status: StageStatus.FAIL,
            reasonCode: 'BUILD_FAILED',
          }),
        ],
        staticFindings: [
          {
            id: 'SECRET',
            severity: 'HIGH',
            category: 'security',
            file: 'app.py',
            line: 4,
            evidence: 'API_KEY=123',
          },
        ],
      }),
    );

    expect(comparison.overallVerdict).toBe('REGRESSED');
    expect(comparison.findingDelta.added).toHaveLength(1);
  });

  it('rechaza comparaciones entre entregas distintas', () => {
    expect(() =>
      service.compare(
        buildRun(),
        buildRun({ id: 'run-d', deliveryId: 'delivery-2' }),
      ),
    ).toThrow(ConflictException);
  });
});
