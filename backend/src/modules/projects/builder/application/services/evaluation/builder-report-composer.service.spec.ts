import { BuilderReportComposer } from './builder-report-composer.service';
import {
  EVALUATIVE_STATES,
  EVALUATIVE_STATE_SENTENCES,
} from '../../../domain/builder.types';
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

  it('mantiene los elogios fuera de las mejoras y del checklist', () => {
    const praise: CodeQualityFinding = {
      title: 'Separación correcta en archivos .h y .c',
      detail:
        'Observación: el código está separado en .h y .c. Impacto: facilita la reutilización. Recomendación: Mantener esta práctica para proyectos futuros.',
      severity: 'low',
      codeSnippet: '',
      level: 'basico',
      conceptExplanation: 'La separación cabecera/implementación permite compilar por módulos.',
    };

    const report = composer.composeReport(
      buildAssessment(),
      { ...emptyQualityFindings, quality: [praise, highQualityFinding] },
      [],
    );

    expect(report.coaching?.strengths).toEqual([
      expect.objectContaining({ title: praise.title }),
    ]);
    expect(report.coaching?.shouldImprove).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: praise.title })]),
    );
    expect(report.coaching?.nextAttemptChecklist.join('\n')).not.toContain(
      praise.title,
    );
  });

  it('limita el checklist a lo bloqueante y a tres pasos', () => {
    const blockers: CodeQualityFinding[] = Array.from({ length: 4 }, (_, i) => ({
      title: `Bloqueo ${i + 1}`,
      detail: `Observación: fallo ${i + 1}. Impacto: rompe la salida. Recomendación: corregir el caso ${i + 1}.`,
      severity: 'high',
      codeSnippet: '',
      level: 'basico',
      conceptExplanation: 'Explicación del fallo.',
    }));

    const report = composer.composeReport(
      buildAssessment(),
      {
        ...emptyQualityFindings,
        quality: [...blockers, highQualityFinding],
        architecture: [
          {
            title: 'Mejora opcional',
            detail:
              'Observación: función larga. Impacto: cuesta leerla. Recomendación: extraer una función auxiliar.',
            severity: 'medium',
            codeSnippet: '',
            level: 'intermedio',
            conceptExplanation: 'Funciones cortas se prueban mejor.',
          },
        ],
      },
      [],
    );

    expect(report.coaching?.nextAttemptChecklist).toHaveLength(3);
    expect(report.coaching?.nextAttemptChecklist.join('\n')).not.toContain(
      'Mejora opcional',
    );
  });

  it('usa las mejoras opcionales en el checklist cuando nada bloquea', () => {
    const report = composer.composeReport(
      buildAssessment(),
      {
        ...emptyQualityFindings,
        quality: [
          {
            title: 'Mejora opcional',
            detail:
              'Observación: función larga. Impacto: cuesta leerla. Recomendación: extraer una función auxiliar.',
            severity: 'medium',
            codeSnippet: '',
            level: 'intermedio',
            conceptExplanation: 'Funciones cortas se prueban mejor.',
          },
        ],
      },
      [],
    );

    expect(report.coaching?.passReadiness).toBe('READY_WITH_SUGGESTIONS');
    expect(report.coaching?.nextAttemptChecklist.join('\n')).toContain(
      'Mejora opcional',
    );
  });

  it('derives pedagogical narrative from structured student summary', () => {
    const studentSummary = [
      '## Logro',
      'Has conseguido que el programa compile sin errores y produzca la primera línea de salida esperada.',
      '## Diagnóstico',
      'El criterio "Formato de salida" falla porque la segunda línea muestra valores invertidos.',
      '## Puente de aprendizaje',
      'Este error se relaciona con el orden de los índices en matrices bidimensionales.',
      '## Próximo paso',
      'Revisa el orden de los índices en la función de impresión antes de reenviar.',
    ].join('\n');

    const report = composer.composeReport(
      buildAssessment({ studentSummary }),
      emptyQualityFindings,
      [],
    );

    expect(report.pedagogicalNarrative).toHaveLength(4);
    expect(report.pedagogicalNarrative?.[0]).toEqual({
      kind: 'success',
      content: expect.stringContaining('compile sin errores'),
    });
    expect(report.pedagogicalNarrative?.[1]).toEqual({
      kind: 'gap',
      content: expect.stringContaining('Formato de salida'),
    });
    expect(report.pedagogicalNarrative?.[2]).toEqual({
      kind: 'bridge',
      content: expect.stringContaining('índices en matrices'),
    });
    expect(report.pedagogicalNarrative?.[3]).toEqual({
      kind: 'action',
      content: expect.stringContaining('Revisa el orden'),
    });
  });

  it('derives teacher highlights from structured teacher summary', () => {
    const teacherSummary = [
      '## Fortalezas',
      'La compilación fue limpia y el código está bien estructurado.',
      '## Preocupaciones',
      'La salida real no coincide con el oráculo en la segunda línea.',
      '## Seguimiento',
      'Sugerir repasar indexación de arrays antes de la siguiente entrega.',
    ].join('\n');

    const report = composer.composeReport(
      buildAssessment({ teacherSummary }),
      emptyQualityFindings,
      [],
    );

    expect(report.teacherHighlights?.strengths).toHaveLength(1);
    expect(report.teacherHighlights?.concerns).toHaveLength(1);
    expect(report.teacherHighlights?.followUp).toHaveLength(1);
    expect(report.teacherHighlights?.strengths[0]).toContain(
      'compilación fue limpia',
    );
  });

  it('builds professional verdict and learning objective', () => {
    const report = composer.composeReport(
      buildAssessment(),
      emptyQualityFindings,
      [],
    );

    expect(report.professionalVerdict).toContain('Apto con observaciones');
    // El veredicto que lee el usuario describe qué hizo el programa en lenguaje
    // llano; el código E1 solo vive en el contrato y en los artefactos.
    expect(report.professionalVerdict).toContain(
      'El programa se ejecutó y su salida coincide con lo esperado.',
    );
    expect(report.professionalVerdict).not.toContain('E1');
    expect(report.learningObjective).toContain('Funcionamiento');
    expect(report.printableMarkdown).toContain('# Informe de evaluación');
  });

  it.each(EVALUATIVE_STATES)(
    'describes %s in plain language and never leaks the code into the verdict',
    (state) => {
      const report = composer.composeReport(
        buildAssessment({ evaluativeState: state }),
        emptyQualityFindings,
        [],
      );

      expect(report.professionalVerdict).toContain(
        EVALUATIVE_STATE_SENTENCES[state],
      );
      // El código del contrato no debe aparecer en la prosa del informe: es el
      // texto que leen alumno y profesor, y fuera del equipo nadie lo interpreta.
      expect(report.professionalVerdict).not.toMatch(/\bE[1-4]\b/);
    },
  );

  it('falls back to heuristic parsing when summaries lack markdown markers', () => {
    const report = composer.composeReport(
      buildAssessment({
        studentSummary:
          'Has logrado compilar el proyecto. El formato de salida es incorrecto porque los índices están invertidos. Entender la indexación de matrices te ayudará. Corrige la función de impresión.',
        teacherSummary:
          'La compilación fue limpia. La salida no coincide con el oráculo. Repasar indexación de arrays.',
      }),
      emptyQualityFindings,
      [],
    );

    expect(report.pedagogicalNarrative?.length).toBeGreaterThanOrEqual(2);
    expect(report.teacherHighlights?.strengths.length).toBeGreaterThanOrEqual(
      1,
    );
  });

  describe('LOW-01: deduplicación de los hallazgos técnicos en bruto', () => {
    it('elimina hallazgos repetidos dentro de una misma categoría', () => {
      const report = composer.composeReport(
        buildAssessment(),
        {
          ...emptyQualityFindings,
          // El modelo repite con frecuencia el mismo hallazgo dentro de una
          // categoría; antes se copiaba verbatim al informe técnico.
          quality: [highQualityFinding, { ...highQualityFinding }],
        },
        [],
      );

      expect(report.technicalFeedback?.quality).toHaveLength(1);
    });

    it('conserva el mismo hallazgo cuando aparece en categorías distintas', () => {
      const report = composer.composeReport(
        buildAssessment(),
        {
          ...emptyQualityFindings,
          quality: [highQualityFinding],
          architecture: [{ ...highQualityFinding }],
        },
        [],
      );

      // La deduplicación es por categoría, no global: un hallazgo que aplique a
      // dos dimensiones es legítimo en ambas.
      expect(report.technicalFeedback?.quality).toHaveLength(1);
      expect(report.technicalFeedback?.architecture).toHaveLength(1);
    });

    it('no altera un listado que ya no tiene duplicados', () => {
      const other: CodeQualityFinding = {
        ...highQualityFinding,
        title: 'Nombres poco descriptivos',
      };
      const report = composer.composeReport(
        buildAssessment(),
        { ...emptyQualityFindings, quality: [highQualityFinding, other] },
        [],
      );

      expect(report.technicalFeedback?.quality).toHaveLength(2);
    });
  });

  describe('enrichGradeBreakdownWithRubric (ARQ-011)', () => {
    it('adjunta peso y descripción al criterio que hace match por nombre normalizado', () => {
      const assessment = buildAssessment({
        gradeBreakdown: [
          {
            criterion: '  Correctitud  ',
            maxPoints: 6,
            awarded: 5,
            justification: 'ok',
          },
          {
            criterion: 'Sin match',
            maxPoints: 4,
            awarded: 4,
            justification: 'ok',
          },
        ],
      });

      composer.enrichGradeBreakdownWithRubric(assessment, [
        { name: 'correctitud', weight: 60, description: 'Salida correcta.' },
      ]);

      expect(assessment.gradeBreakdown[0]).toEqual(
        expect.objectContaining({ weight: 60, description: 'Salida correcta.' }),
      );
      // El criterio sin correspondencia en la rúbrica queda intacto (sin peso).
      expect(assessment.gradeBreakdown[1].weight).toBeUndefined();
    });

    it('no hace nada si no hay rúbrica configurada', () => {
      const assessment = buildAssessment({
        gradeBreakdown: [
          { criterion: 'X', maxPoints: 1, awarded: 1, justification: 'ok' },
        ],
      });
      const original = [...assessment.gradeBreakdown];

      composer.enrichGradeBreakdownWithRubric(assessment, null);

      expect(assessment.gradeBreakdown).toEqual(original);
    });

    it('no hace nada si gradeBreakdown no es un array', () => {
      const assessment = buildAssessment({
        gradeBreakdown: undefined as never,
      });

      expect(() =>
        composer.enrichGradeBreakdownWithRubric(assessment, [
          { name: 'x', weight: 1, description: 'd' },
        ]),
      ).not.toThrow();
    });
  });
});
