import { parseBuilderEvaluationContractV2 } from './builder-evaluation-contract.parser';

function buildEvaluationPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'evaluation',
    thought: 'La ejecución confirma el comportamiento esperado.',
    structuralType: 'T4',
    capabilities: {
      C1: { status: 'yes', rationale: 'Instalación reproducible.' },
      C2: { status: 'yes', rationale: 'Arranca correctamente.' },
      C3: { status: 'yes', rationale: 'El servicio responde.' },
      C4: { status: 'yes', rationale: 'Los tests pasan.' },
      C5: { status: 'yes', rationale: 'Hay healthcheck funcional.' },
      C6: { status: 'no', rationale: 'No requiere secretos externos.' },
    },
    evaluativeState: 'E1',
    confidence: 'high',
    rationale: 'Ejecución completa con evidencia suficiente.',
    recommendedGrade: 8.75,
    externalRequirements: [],
    runtime: {
      family: 'python',
      version: '3.11',
    },
    recipe: {
      install: [['python', '-m', 'pip', 'install', '.']],
      run: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
      test: [['pytest', '-q']],
      systemPackages: ['curl'],
      cwd: '/app',
      environment: {
        APP_ENV: 'prod',
      },
      service: {
        port: 8000,
        healthcheck: ['curl', '-sf', 'http://localhost:8000/health'],
      },
    },
    evidenceSummary: 'Servicio levantado y suite de tests en verde.',
    observedEvidence: [
      'Detectado requirements.txt en la raíz del proyecto.',
      'Uvicorn respondió 200 OK en GET /health.',
      'Suite pytest completada con 3/3 tests aprobados.',
    ],
    evaluationLimits: [],
    ...overrides,
  };
}

describe('parseBuilderEvaluationContractV2', () => {
  it('parses a valid evaluation contract with evidence', () => {
    const raw = JSON.stringify(buildEvaluationPayload());

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.stage).toBe('evaluation');
    expect(contract.recommendedGrade).toBe(8.75);
    expect(contract.observedEvidence).toHaveLength(3);
    expect(contract.recipe.service?.port).toBe(8000);
  });

  it('normalizes structured observed evidence objects into plain strings', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        observedEvidence: [
          {
            file: 'main.py',
            content: 'El script arranco sin errores.',
          },
          {
            file: 'weather.json',
            content: 'Se cargo el dataset de prueba.',
          },
          {
            file: 'stdout',
            content: 'Se imprimio la media y los extremos.',
          },
        ],
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.observedEvidence).toEqual([
      'main.py: El script arranco sin errores.',
      'weather.json: Se cargo el dataset de prueba.',
      'stdout: Se imprimio la media y los extremos.',
    ]);
  });

  it('normalizes flat install commands from the evaluator into a single command matrix row', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        recipe: {
          install: [
            'gcc',
            '-Wall',
            '-Wextra',
            '-std=c11',
            'main.c',
            '-o',
            'calculator',
          ],
          run: ['./calculator', '7', '8'],
          test: ['valgrind', './calculator', '7', '8'],
          systemPackages: ['curl'],
          cwd: '/app',
          environment: {
            APP_ENV: 'prod',
          },
          service: null,
        },
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.recipe.install).toEqual([
      ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'calculator'],
    ]);
    expect(contract.recipe.run).toEqual(['./calculator', '7', '8']);
    expect(contract.recipe.test).toEqual([
      ['valgrind', './calculator', '7', '8'],
    ]);
  });

  it('fails when observed evidence is insufficient', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        observedEvidence: [],
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow(
      'observedEvidence debe incluir al menos 1 evidencia concreta.',
    );
  });

  it('fails when the evaluative state is invalid', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        evaluativeState: 'BROKEN',
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow(
      'evaluativeState inválido en evaluador LLM.',
    );
  });

  it('fails when evaluativeState=E3 (fail) is paired with a passing recommendedGrade', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        evaluativeState: 'E3',
        recommendedGrade: 7,
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow(
      'evaluativeState=E3 es incompatible con recommendedGrade=7 (máximo 2).',
    );
  });

  it('fails when evaluativeState=E4 (fail) is paired with a passing recommendedGrade', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        evaluativeState: 'E4',
        recommendedGrade: 9,
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow(
      'evaluativeState=E4 es incompatible con recommendedGrade=9 (máximo 2).',
    );
  });

  it('allows evaluativeState=E3/E4 when recommendedGrade stays within the failing range', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        evaluativeState: 'E3',
        recommendedGrade: 1.5,
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);
    expect(contract.evaluativeState).toBe('E3');
    expect(contract.recommendedGrade).toBe(1.5);
  });

  it('a present-but-invalid runtime (null) does not bypass the grade/state invariant', () => {
    // Reproduce exacta del escenario del finding: runtime:null, E4, nota 10,
    // observedEvidence vacío. Antes, safeNormalizeRuntimeDescriptor atrapaba
    // la excepción de normalizeRuntimeDescriptor(null, ...) y la etiquetaba
    // como "truncamiento", lo que desactivaba assertEvaluationSemanticConsistency
    // por completo — incluida la invariante E3/E4 ⇒ nota ≤2. Ahora un
    // `runtime` presente pero inválido debe fallar como cualquier otro campo
    // mal formado del contrato, no aceptarse con confidence low.
    const raw = JSON.stringify(
      buildEvaluationPayload({
        runtime: null,
        evaluativeState: 'E4',
        recommendedGrade: 10,
        observedEvidence: [],
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow();
  });

  it('a genuinely absent runtime/recipe (key missing) still enforces the grade/state invariant', () => {
    const payload = buildEvaluationPayload({
      evaluativeState: 'E4',
      recommendedGrade: 9,
    });
    delete (payload as Record<string, unknown>).runtime;
    delete (payload as Record<string, unknown>).recipe;

    expect(() =>
      parseBuilderEvaluationContractV2(JSON.stringify(payload)),
    ).toThrow(
      'evaluativeState=E4 es incompatible con recommendedGrade=9 (máximo 2).',
    );
  });

  it('a genuinely truncated contract (runtime/recipe keys absent) still parses with confidence low when grade/state are consistent', () => {
    const payload = buildEvaluationPayload({
      evaluativeState: 'E1',
      recommendedGrade: 5,
    });
    delete (payload as Record<string, unknown>).runtime;
    delete (payload as Record<string, unknown>).recipe;

    const contract = parseBuilderEvaluationContractV2(JSON.stringify(payload));

    expect(contract.confidence).toBe('low');
    expect(contract.runtime.family).toBe('unknown');
    expect(contract.evaluationLimits).toContainEqual(
      expect.stringContaining('TRUNCATED'),
    );
  });

  it('preserves clear parser errors for malformed payloads', () => {
    expect(() => parseBuilderEvaluationContractV2('{"stage":')).toThrow(
      'La salida del evaluador LLM no es JSON válido.',
    );
  });

  it('overrides recommendedGrade with the gradeBreakdown sum when they differ', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        recommendedGrade: 9,
        gradeBreakdown: [
          {
            criterion: 'Compilación',
            maxPoints: 3,
            awarded: 3,
            justification: 'Sin warnings.',
          },
          {
            criterion: 'Casos de prueba',
            maxPoints: 5,
            awarded: 5,
            justification: 'Todos superados.',
          },
          {
            criterion: 'Gestión de memoria',
            maxPoints: 2,
            awarded: 0,
            justification: 'No evaluable.',
          },
        ],
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.recommendedGrade).toBe(8);
    expect(contract.gradeBreakdown).toHaveLength(3);
  });

  // Si el modelo puntúa cada criterio sobre el peso porcentual de la rúbrica, la
  // suma se acerca a 100. Recortarla a 10 convertiría cualquier entrega en un
  // sobresaliente sin dejar rastro; reescalar preserva la proporción y lo declara.
  it('rescales the grade when the breakdown does not use the 0-10 scale', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        recommendedGrade: 10,
        gradeBreakdown: [
          {
            criterion: 'Correctitud',
            maxPoints: 60,
            awarded: 45,
            justification: 'Salida correcta con matices.',
          },
          {
            criterion: 'Calidad',
            maxPoints: 40,
            awarded: 20,
            justification: 'Duplicación evidente.',
          },
        ],
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.recommendedGrade).toBe(6.5);
    expect(contract.evaluationLimits).toContainEqual(
      expect.stringContaining('RESCALED'),
    );
  });

  it('preserves recommendedGrade when gradeBreakdown is empty', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        recommendedGrade: 7.5,
        gradeBreakdown: [],
      }),
    );

    const contract = parseBuilderEvaluationContractV2(raw);

    expect(contract.recommendedGrade).toBe(7.5);
  });
});
