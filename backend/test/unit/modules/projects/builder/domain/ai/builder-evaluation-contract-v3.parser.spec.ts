import { parseBuilderEvaluationContractV3 } from '@app/modules/projects/builder/domain/ai/builder-evaluation-contract-v3.parser';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'builder-evaluation/v3',
    stage: 'evaluation',
    thought: 'La ejecución confirma el comportamiento principal.',
    structuralType: 'T1',
    capabilities: {
      C1: { status: 'yes', rationale: 'Instalación reproducible.' },
      C2: { status: 'yes', rationale: 'Arranca correctamente.' },
      C3: { status: 'yes', rationale: 'Produce la salida esperada.' },
      C4: { status: 'yes', rationale: 'Los tests públicos pasan.' },
      C5: { status: 'unknown', rationale: 'No aplica un servicio.' },
      C6: { status: 'no', rationale: 'No requiere secretos.' },
    },
    evaluativeState: 'E1',
    confidence: 'high',
    rationale: 'Hay evidencia suficiente y trazable.',
    recommendedGrade: 1,
    externalRequirements: [],
    runtime: { family: 'python', version: '3.11' },
    recipe: {
      install: [],
      run: ['python', 'main.py'],
      test: [['pytest', '-q']],
      systemPackages: [],
      cwd: '/app',
      environment: {},
      service: null,
    },
    evidenceSummary: 'Ejecución y fuente revisadas.',
    evidence: [
      {
        kind: 'execution',
        summary: 'Tests públicos',
        detail: '4 de 4 tests correctos.',
      },
      {
        kind: 'execution',
        summary: 'Test docente oculto',
        detail: 'El oráculo secreto coincide.',
      },
    ],
    criteria: [
      {
        name: 'Funcionalidad',
        maxPoints: 10,
        awarded: 8,
        justification: 'El flujo principal funciona.',
        evidenceRefs: [0],
      },
    ],
    findings: [
      {
        severity: 'medium',
        title: 'Falta un caso límite',
        explanation: 'No se valida la entrada vacía.',
        recommendation: 'Añade una guarda explícita.',
        blocking: false,
        evidenceRefs: [0],
      },
    ],
    limitations: ['No se probó en Windows.'],
    reviewFlags: [],
    ...overrides,
  };
}

describe('parseBuilderEvaluationContractV3', () => {
  it('assigns stable backend ids, visibility and recomputes the grade', () => {
    const first = parseBuilderEvaluationContractV3(JSON.stringify(payload()));
    const second = parseBuilderEvaluationContractV3(JSON.stringify(payload()));

    expect(first.schemaVersion).toBe('builder-evaluation/v3');
    expect(first.recommendedGrade).toBe(8);
    expect(first.evidence.map((item) => item.id)).toEqual(
      second.evidence.map((item) => item.id),
    );
    expect(first.criteria[0].evidenceIds).toEqual([first.evidence[0].id]);
    expect(first.criteria[0].status).toBe('PARTIAL');
    expect(first.evidence[0].visibility).toBe('teacher');
    expect(first.evidence[1].visibility).toBe('teacher');
    expect(first).not.toHaveProperty('studentSummary');
    expect(first).not.toHaveProperty('teacherSummary');
  });

  it('repairs an E3 grade cap while keeping the criteria total coherent', () => {
    const parsed = parseBuilderEvaluationContractV3(
      JSON.stringify(
        payload({
          evaluativeState: 'E3',
          recommendedGrade: 3,
          criteria: [
            {
              name: 'Funcionalidad',
              maxPoints: 10,
              awarded: 3,
              justification: 'Solo hay logs de compilación.',
              evidenceRefs: [0],
            },
          ],
        }),
      ),
    );

    expect(parsed.evaluativeState).toBe('E3');
    expect(parsed.recommendedGrade).toBe(2);
    expect(parsed.criteria[0].awarded).toBe(2);
    expect(
      parsed.gradeBreakdown.reduce((sum, item) => sum + item.awarded, 0),
    ).toBe(2);
    expect(parsed.confidence).toBe('low');
    expect(parsed.evaluationLimits).toContainEqual(
      expect.stringContaining('INVALID_CONTRACT_REPAIRED'),
    );
  });

  it('rejects evidence references that do not exist', () => {
    expect(() =>
      parseBuilderEvaluationContractV3(
        JSON.stringify(
          payload({
            criteria: [
              {
                name: 'Funcionalidad',
                maxPoints: 10,
                awarded: 8,
                justification: 'Correcto.',
                evidenceRefs: [99],
              },
            ],
          }),
        ),
      ),
    ).toThrow('referencia evidencia inexistente');
  });

  it('rejects audience copy in the immutable evaluation contract', () => {
    expect(() =>
      parseBuilderEvaluationContractV3(
        JSON.stringify(payload({ teacherSummary: 'No debe entrar aquí.' })),
      ),
    ).toThrow('no admite narrativa por audiencia');
  });
});
