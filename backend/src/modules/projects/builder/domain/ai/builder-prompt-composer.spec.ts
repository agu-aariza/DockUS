import {
  composeEvaluationPrompt,
  composePlanPrompt,
  composeQualityPrompt,
} from './builder-prompt-composer';

describe('builder prompt composer', () => {
  it('preserves the oracle block in plan prompts while truncating the workspace section', () => {
    const payload = composePlanPrompt(
      'A'.repeat(4000),
      {
        expectedType: 'C_CLI',
        rubricInstructions: 'Compila, ejecuta y valida la salida.',
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
