import { BuilderReportStageHandler } from '@app/modules/projects/builder/application/services/stages/report-stage.handler';
import { BuildRunArtifactType } from '@app/modules/projects/builder/domain/entities/build-run-artifact.entity';

const assessment = {
  schemaVersion: 'builder-evaluation/v3',
  stage: 'evaluation',
  recommendedGrade: 6,
  confidence: 'medium',
  rationale: 'Evaluación válida.',
  criteria: [
    {
      id: 'criterion-1',
      criterion: 'Funcionalidad',
      maxPoints: 10,
      awarded: 6,
      status: 'PARTIAL',
      justification: 'El caso principal funciona.',
      evidenceIds: ['evidence-1'],
    },
  ],
  findings: [
    {
      id: 'finding-1',
      severity: 'medium',
      title: 'Falta un caso límite',
      explanation: 'No valida la entrada vacía.',
      recommendation: 'Añade una guarda.',
      blocking: false,
      evidenceIds: ['evidence-1'],
    },
  ],
  evidence: [],
  limitations: [],
  reviewFlags: [],
} as any;

describe('BuilderReportStageHandler', () => {
  const pedagogical = {
    generateFeedback: jest.fn(() => ({ items: [] })),
    toTechnicalFeedbackItems: jest.fn(() => []),
  };
  const composer = {
    composeReportV3: jest.fn(() => ({
      schemaVersion: 'builder-report/v3',
      overallOutcome: 'PASS_WITH_WARNINGS',
    })),
  };
  const persister = {
    persistPromptArtifact: jest.fn(),
    persistStageTraceArtifacts: jest.fn(),
    persistJsonArtifact: jest.fn(),
  };
  const evaluator = { reportWithTrace: jest.fn() };
  let handler: BuilderReportStageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new BuilderReportStageHandler(
      pedagogical as any,
      composer as any,
      persister as any,
      evaluator as any,
    );
  });

  it('uses deterministic copy when reporting returns an invalid contract', async () => {
    evaluator.reportWithTrace.mockResolvedValue({
      stage: 'reporting',
      prompt: 'prompt',
      rawResponse: '{truncated',
      parsedContract: null,
      error: { code: 'invalid_contract', message: 'JSON truncado' },
      usage: { inputTokens: 20, outputTokens: 5 },
      modelProfile: { providerId: 'test', modelId: 'model' },
    });

    const result = await handler.handle({
      runId: 'run-1',
      assessment,
      qualityFindings: {} as any,
      execution: {} as any,
    });

    expect(composer.composeReportV3).toHaveBeenCalledWith(
      assessment,
      expect.objectContaining({
        schemaVersion: 'builder-report-copy/v1',
        stage: 'reporting',
      }),
      expect.anything(),
      expect.anything(),
      { usedFallback: true, errorCode: 'invalid_contract' },
    );
    expect(result.report.schemaVersion).toBe('builder-report/v3');
    expect(persister.persistJsonArtifact).toHaveBeenCalledWith(
      'run-1',
      BuildRunArtifactType.REPORT_JSON,
      result.report,
      expect.any(String),
    );
  });

  it('does not fail the run when the reporting call times out', async () => {
    evaluator.reportWithTrace.mockRejectedValue(new Error('timeout'));

    await expect(
      handler.handle({
        runId: 'run-2',
        assessment,
        qualityFindings: {} as any,
        execution: {} as any,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        report: expect.objectContaining({ schemaVersion: 'builder-report/v3' }),
        usages: [],
      }),
    );
    expect(persister.persistJsonArtifact).toHaveBeenNthCalledWith(
      1,
      'run-2',
      BuildRunArtifactType.LLM_REPORT_ERROR,
      expect.objectContaining({ code: 'internal_error', error: 'timeout' }),
      expect.any(String),
    );
    expect(composer.composeReportV3).toHaveBeenCalledWith(
      assessment,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { usedFallback: true, errorCode: 'internal_error' },
    );
  });
});
