import {
  composeEvaluationPrompt,
  composePlanPrompt,
  composeQualityPrompt,
  renderRubricSection,
} from './builder-prompt-composer';

describe('renderRubricSection', () => {
  it('falls back to a placeholder when no rubric is defined', () => {
    const rendered = renderRubricSection({
      expectedType: null,
      rubricInstructions: null,
      expectedOutput: null,
      rubricCriteria: null,
    });
    expect(rendered).toBe('No rubric instructions were provided.');
  });

  // Los pesos se convierten a puntos sobre 10 antes de llegar al modelo: si se
  // le pasan como porcentajes, puede puntuar cada criterio sobre su porcentaje y
  // la suma del desglose se dispara muy por encima de 10.
  it('renders weighted criteria as points on the 0-10 scale', () => {
    const rendered = renderRubricSection({
      expectedType: 'C_CLI',
      rubricInstructions: 'Sé estricto con los warnings.',
      expectedOutput: null,
      rubricCriteria: [
        { name: 'Correctitud', weight: 60, description: 'Salida correcta.' },
        { name: 'Calidad', weight: 40, description: null },
      ],
    });

    expect(rendered).toContain('Sé estricto con los warnings.');
    expect(rendered).toContain('WEIGHTED RUBRIC CRITERIA');
    expect(rendered).toContain('Correctitud (maxPoints: 6): Salida correcta.');
    expect(rendered).toContain('Calidad (maxPoints: 4)');
    expect(rendered).not.toContain('% of the final grade');
  });
});

describe('builder prompt composer', () => {
  it('preserves the oracle block in plan prompts while truncating the workspace section', () => {
    const payload = composePlanPrompt(
      'A'.repeat(4000),
      {
        expectedType: 'C_CLI',
        rubricInstructions: 'Compila, ejecuta y valida la salida.',
        rubricCriteria: null,
        expectedOutput: './main 7 8',
      },
      260,
    );

    expect(payload.prompt.length).toBeLessThanOrEqual(260);
    expect(payload.prompt).toContain('EXPECTED OUTPUT ORACLE');
    expect(payload.prompt).toContain('./main 7 8');
    expect(
      payload.sections.find((section) => section.label === 'STUDENT WORKSPACE'),
    ).toEqual(
      expect.objectContaining({
        truncated: true,
      }),
    );
  });

  it('composes evaluation prompts as explicit evidence sections instead of a single blob', () => {
    const payload = composeEvaluationPrompt(
      'print("ok")\n'.repeat(400),
      {
        schemaVersion: 'builder-llm/v2',
        stage: 'facts',
        thought: 'Hechos.',
        observedStdout: ['ok'],
        observedStderr: [],
        exitCode: 0,
        compilationStatus: 'not_applicable',
        matchesOracle: false,
        discrepancies: ['Se esperaba 15 pero no se produjo salida.'],
        filesPresent: ['main.py'],
        executionSummary: 'El programa imprimió ok.',
        evidenceLimits: [],
      },
      {
        expectedType: 'PYTHON_CLI',
        rubricInstructions: 'Valida el comportamiento funcional.',
        rubricCriteria: null,
        expectedOutput: '15',
      },
      {
        schemaVersion: 'builder-llm/v2',
        stage: 'plan',
        thought: 'Plan.',
        structuralType: 'T2',
        capabilities: {
          C1: { status: 'yes', rationale: 'ok' },
          C2: { status: 'yes', rationale: 'ok' },
          C3: { status: 'no', rationale: 'ok' },
          C4: { status: 'unknown', rationale: 'ok' },
          C5: { status: 'no', rationale: 'ok' },
          C6: { status: 'unknown', rationale: 'ok' },
        },
        evaluativeState: 'E2',
        confidence: 'medium',
        rationale: 'Plan',
        externalRequirements: [],
        runtime: {
          family: 'python',
          version: '3.11',
          supported: true,
          reason: null,
        },
        recipe: {
          install: [],
          run: ['python', 'main.py'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
        evidenceSummary: '',
        observedEvidence: [],
        evaluationLimits: [],
      },
      320,
    );

    expect(payload.prompt.length).toBeLessThanOrEqual(320);
    expect(payload.prompt).toContain('VERIFIED FACTS');
    expect(payload.prompt).toContain('SOURCE EXCERPTS');
    expect(payload.prompt).toContain('PLANNER HYPOTHESIS SUMMARY');
    expect(payload.prompt).toContain('EXPECTED OUTPUT ORACLE');
  });

  it('keeps quality prompts centered on assessment plus source and logs', () => {
    const payload = composeQualityPrompt(
      'int main(void) { return 0; }\n'.repeat(300),
      'warning: implicit declaration\n'.repeat(200),
      {
        expectedType: 'C_CLI',
        rubricInstructions: 'Evalua seguridad y mantenibilidad.',
        rubricCriteria: null,
        expectedOutput: '15',
      },
      {
        schemaVersion: 'builder-llm/v2',
        stage: 'evaluation',
        thought: 'Eval.',
        structuralType: 'T2',
        capabilities: {
          C1: { status: 'yes', rationale: 'ok' },
          C2: { status: 'no', rationale: 'ok' },
          C3: { status: 'no', rationale: 'ok' },
          C4: { status: 'unknown', rationale: 'ok' },
          C5: { status: 'no', rationale: 'ok' },
          C6: { status: 'unknown', rationale: 'ok' },
        },
        evaluativeState: 'E3',
        confidence: 'medium',
        rationale: 'Eval',
        recommendedGrade: 4,
        externalRequirements: [],
        runtime: {
          family: 'c',
          version: 'c11',
          supported: true,
          reason: null,
        },
        recipe: {
          install: [],
          run: ['./main'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
        evidenceSummary: '',
        observedEvidence: [],
        evaluationLimits: [],
        gradeBreakdown: [],
        studentSummary: '',
        teacherSummary: '',
      },
      360,
    );

    expect(payload.prompt.length).toBeLessThanOrEqual(360);
    expect(payload.sections.map((section) => section.label)).toEqual([
      'ASSIGNMENT CONTEXT',
      'CURRENT ACADEMIC ASSESSMENT',
      'SOURCE EXCERPTS',
      'EXECUTION LOGS',
    ]);
  });
});
