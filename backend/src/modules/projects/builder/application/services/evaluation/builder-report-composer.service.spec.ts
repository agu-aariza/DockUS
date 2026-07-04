import { BuilderReportComposer } from './builder-report-composer.service';
import type {
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  CodeQualityFinding,
} from '../../../domain/builder.types';

const highQualityFinding: CodeQualityFinding = {
  title: 'Complejidad elevada',
  detail:
    'Observacion: el codigo puede simplificarse. Impacto: dificulta mantenimiento. Recomendacion: extrae funciones pequeñas.',
  severity: 'high',
  codeSnippet: '',
  level: 'intermedio',
  conceptExplanation:
    'La entrega funciona, pero puede mejorar su estructura interna.',
};

const emptyQualityFindings: BuilderCodeQualityContractV2 = {
  thought: 'quality checked',
  security: [],
  architecture: [],
  quality: [],
  rubricCompliance: [],
};

function buildAssessment(
  overrides: Partial<BuilderEvaluationContractV2> = {},
): BuilderEvaluationContractV2 {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'evaluation',
    thought: 'evaluation checked',
    structuralType: 'T1',
    capabilities: {
      C1: { status: 'yes', rationale: 'Proyecto identificado.' },
      C2: { status: 'yes', rationale: 'Entrada ejecutable.' },
      C3: { status: 'no', rationale: 'No expone servicio.' },
      C4: { status: 'yes', rationale: 'Pruebas superadas.' },
      C5: { status: 'no', rationale: 'No requiere healthcheck.' },
      C6: { status: 'no', rationale: 'Sin requisitos externos.' },
    },
    evaluativeState: 'E1',
    confidence: 'high',
    rationale: 'Cumple la rubrica funcional completa.',
    externalRequirements: [],
    runtime: {
      family: 'python',
      version: '3.12',
      supported: true,
      reason: null,
    },
    recipe: {
      install: [],
      run: ['python', 'main.py'],
      test: [],
      systemPackages: [],
      cwd: null,
      environment: null,
      service: null,
    },
    evidenceSummary: 'La ejecucion coincide con el resultado esperado.',
    observedEvidence: ['tests ok'],
    evaluationLimits: [],
    recommendedGrade: 10,
    gradeBreakdown: [
      {
        criterion: 'Funcionamiento',
        maxPoints: 10,
        awarded: 10,
        justification: 'Cumple completamente el criterio.',
      },
    ],
    studentSummary: 'Buen trabajo.',
    teacherSummary: 'Entrega validada correctamente.',
    ...overrides,
  };
}

describe('BuilderReportComposer', () => {
  let composer: BuilderReportComposer;

  beforeEach(() => {
    composer = new BuilderReportComposer();
  });

  it('keeps an E1 evaluation as PASS even when quality coaching is blocked', () => {
    const report = composer.composeReport(
      buildAssessment(),
      {
        ...emptyQualityFindings,
        quality: [highQualityFinding],
      },
      [],
    );

    expect(report.overallOutcome).toBe('PASS');
    expect(report.coaching?.passReadiness).toBe('BLOCKED');
    expect(report.coaching?.mustFix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Complejidad elevada' }),
      ]),
    );
  });

  it('still maps a blocked non-E1 evaluation to a non-passing outcome', () => {
    const report = composer.composeReport(
      buildAssessment({ evaluativeState: 'E3', recommendedGrade: 2 }),
      {
        ...emptyQualityFindings,
        rubricCompliance: [highQualityFinding],
      },
      [],
    );

    expect(report.overallOutcome).toBe('FAIL');
    expect(report.coaching?.passReadiness).toBe('BLOCKED');
  });
});
