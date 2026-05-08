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
          install: ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'calculator'],
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
    expect(contract.recipe.test).toEqual([['valgrind', './calculator', '7', '8']]);
  });

  it('fails when observed evidence is insufficient', () => {
    const raw = JSON.stringify(
      buildEvaluationPayload({
        observedEvidence: ['Solo un apunte genérico.'],
      }),
    );

    expect(() => parseBuilderEvaluationContractV2(raw)).toThrow(
      'observedEvidence debe incluir al menos 3 evidencias concretas.',
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

  it('preserves clear parser errors for malformed payloads', () => {
    expect(() => parseBuilderEvaluationContractV2('{"stage":')).toThrow(
      'La salida del evaluador LLM no es JSON válido.',
    );
  });
});
