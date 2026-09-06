import {
  composeEvaluationPrompt,
  composePlanPrompt,
  composeQualityPrompt,
  composeReportingPrompt,
  renderRubricSection,
} from '@app/modules/projects/builder/domain/ai/builder-prompt-composer';

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

  it('preserves weighted criteria at the beginning when rubric instructions are lengthy', () => {
    const rendered = renderRubricSection({
      expectedType: 'PYTHON_CLI',
      rubricInstructions: 'Instrucciones docentes extensas. '.repeat(150),
      expectedOutput: 'ok',
      rubricCriteria: [
        {
          name: 'CRITERIO_CANONICO',
          weight: 100,
          description: 'Comprobar la salida.',
        },
      ],
    });

    // The weighted criteria block must come before the instructions
    const criteriaPos = rendered.indexOf('CRITERIO_CANONICO');
    const instructionsPos = rendered.indexOf('Instrucciones docentes extensas.');
    expect(criteriaPos).toBeGreaterThan(-1);
    expect(instructionsPos).toBeGreaterThan(-1);
    expect(criteriaPos).toBeLessThan(instructionsPos);
  });

  it('preserves exitCode and essential fields when facts contains large stdout', () => {
    const payload = composeEvaluationPrompt(
      'print("ok")',
      {
        schemaVersion: 'builder-llm/v2',
        stage: 'facts',
        thought: 'Hechos con salida muy grande.',
        observedStdout: ['x'.repeat(7000)],
        observedStderr: [],
        exitCode: 42,
        compilationStatus: 'not_applicable',
        matchesOracle: false,
        discrepancies: [],
        filesPresent: ['main.py'],
        executionSummary: 'Salida masiva observada.',
        evidenceLimits: [],
      },
      {
        expectedType: 'PYTHON_CLI',
        rubricInstructions: 'Comprobar salida.',
        rubricCriteria: null,
        expectedOutput: 'ok',
      },
      undefined,
      25000,
    );

    expect(payload.prompt).toContain('"exitCode": 42');
    expect(payload.prompt).toContain('"compilationStatus": "not_applicable"');
    const factsSection = payload.sections.find(
      (s) => s.label === 'VERIFIED FACTS',
    );
    expect(factsSection).toBeDefined();
  });

  it('generates valid JSON with findings preserved when reporting assessment has long reasoning', () => {
    const payload = composeReportingPrompt(
      {
        schemaVersion: 'builder-evaluation/v3',
        stage: 'evaluation',
        thought: 'Razonamiento sintético extenso. '.repeat(500),
        structuralType: 'T4',
        capabilities: {
          C1: { status: 'yes', rationale: 'ok' },
          C2: { status: 'yes', rationale: 'ok' },
          C3: { status: 'no', rationale: 'ok' },
          C4: { status: 'yes', rationale: 'ok' },
          C5: { status: 'no', rationale: 'ok' },
          C6: { status: 'no', rationale: 'ok' },
        },
        evaluativeState: 'E1',
        confidence: 'high',
        rationale: 'Evaluacion completa.',
        recommendedGrade: 8,
        externalRequirements: [],
        runtime: {
          family: 'python',
          version: '3.11',
        },
        recipe: {
          install: [],
          run: ['python', 'app.py'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
        evidenceSummary: 'Todo correcto.',
        criteria: [
          {
            id: 'crit-1',
            criterion: 'Funcionalidad',
            maxPoints: 10,
            awarded: 8,
            status: 'pass',
            justification: 'Cumple los requisitos principales.',
            evidenceIds: ['ev-1'],
          },
        ],
        gradeBreakdown: [],
        evidence: [
          {
            id: 'ev-1',
            kind: 'execution',
            summary: 'Salida esperada.',
            detail: 'Salida coincide con el oraculo.',
            visibility: 'student',
          },
        ],
        findings: [
          {
            id: 'find-1',
            severity: 'low',
            title: 'Refactorización menor',
            explanation: 'Variables podrían nombrarse más descriptivamente.',
            recommendation: 'Usar nombres significativos.',
            blocking: false,
            evidenceIds: ['ev-1'],
          },
        ],
        limitations: [],
        reviewFlags: [],
      },
      16000,
    );

    // Extract the JSON content of the VALIDATED EVALUATION section
    const jsonStart = payload.prompt.indexOf('{');
    const jsonString = payload.prompt.slice(jsonStart);
    const parsed = JSON.parse(jsonString);
    expect(parsed.schemaVersion).toBe('builder-evaluation/v3');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].title).toBe('Refactorización menor');
    expect(parsed.criteria).toHaveLength(1);
  });
});
