import { parseBuilderReportCopyContractV1 } from '@app/modules/projects/builder/domain/ai/builder-report-copy-contract.parser';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'builder-report-copy/v1',
    stage: 'reporting',
    studentNarrative: {
      headline: 'Tu solución ya resuelve el flujo principal.',
      achievements: ['Has separado bien las responsabilidades.'],
      gaps: ['Falta tratar la entrada vacía.'],
      conceptBridges: ['Una guarda temprana simplifica el flujo.'],
      nextSteps: ['Añade el caso vacío y su test.'],
    },
    teacherNarrative: {
      executiveSummary: 'Entrega funcional con un caso límite pendiente.',
      strengths: ['Estructura clara.'],
      concerns: ['Validación incompleta.'],
      followUp: ['Revisar el caso vacío con el alumno.'],
      reviewQuestions: ['¿Qué contrato espera para una entrada vacía?'],
    },
    ...overrides,
  };
}

describe('parseBuilderReportCopyContractV1', () => {
  it('accepts audience narratives without evaluation fields', () => {
    const result = parseBuilderReportCopyContractV1(JSON.stringify(payload()));

    expect(result.stage).toBe('reporting');
    expect(result.studentNarrative.nextSteps).toHaveLength(1);
    expect(result.teacherNarrative.followUp).toHaveLength(1);
  });

  it.each(['recommendedGrade', 'score', 'awardedPoints', 'confidence'])(
    'rejects the forbidden evaluation key %s at any depth',
    (key) => {
      const value = payload();
      (value.studentNarrative as Record<string, unknown>)[key] = 10;

      expect(() =>
        parseBuilderReportCopyContractV1(JSON.stringify(value)),
      ).toThrow('intenta modificar la evaluación');
    },
  );

  it('rejects unknown top-level fields instead of silently accepting them', () => {
    expect(() =>
      parseBuilderReportCopyContractV1(
        JSON.stringify(payload({ rationale: 'interno' })),
      ),
    ).toThrow('campos no permitidos');
  });
});
