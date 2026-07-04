import { parseBuilderPlanContractV2 } from './builder-plan-contract.parser';

function buildPlanPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'plan',
    thought: 'Proyecto Python ejecutable.',
    structuralType: 'T4',
    capabilities: {
      C1: { status: 'yes', rationale: 'Manifiesto detectado.' },
      C2: { status: 'yes', rationale: 'Comando de entrada detectado.' },
      C3: { status: 'no', rationale: 'No expone servicio persistente.' },
      C4: { status: 'yes', rationale: 'Suite pytest presente.' },
      C5: {
        status: 'no',
        rationale: 'Sin healthcheck porque no hay servicio.',
      },
      C6: { status: 'no', rationale: 'No requiere configuración externa.' },
    },
    evaluativeState: 'E2',
    confidence: 'high',
    rationale: 'Plan consistente para ejecución efímera.',
    externalRequirements: [],
    runtime: {
      family: 'python',
      version: '3.11',
    },
    recipe: {
      install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
      run: ['python', 'app.py'],
      test: [['pytest', '-q']],
      systemPackages: ['curl'],
      cwd: '/app',
      environment: {
        APP_ENV: 'test',
      },
      service: null,
    },
    evidenceSummary: '',
    observedEvidence: [],
    evaluationLimits: [],
    ...overrides,
  };
}

describe('parseBuilderPlanContractV2', () => {
  it('parses a valid Python CLI plan contract', () => {
    const raw = JSON.stringify(buildPlanPayload());

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.schemaVersion).toBe('builder-llm/v2');
    expect(contract.stage).toBe('plan');
    expect(contract.runtime.family).toBe('python');
    expect(contract.runtime.version).toBe('3.11');
    expect(contract.runtime.supported).toBe(true);
    expect(contract.recipe.cwd).toBe('/app');
    expect(contract.recipe.environment).toEqual({ APP_ENV: 'test' });
    expect(contract.recipe.run).toEqual(['python', 'app.py']);
  });

  it('parses a valid C CLI plan contract with local executable output', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        structuralType: 'T1',
        capabilities: {
          C1: { status: 'yes', rationale: 'Proyecto C compilable.' },
          C2: { status: 'yes', rationale: 'Entrada CLI detectable.' },
          C3: { status: 'no', rationale: 'No expone servicio persistente.' },
          C4: {
            status: 'yes',
            rationale: 'Puede validarse con pruebas batch.',
          },
          C5: { status: 'no', rationale: 'No aplica healthcheck.' },
          C6: { status: 'no', rationale: 'Sin configuracion externa.' },
        },
        runtime: {
          family: 'c',
          version: 'c11',
        },
        recipe: {
          install: [
            ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main'],
          ],
          run: ['./main'],
          test: [['valgrind', './main']],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.runtime.family).toBe('c');
    expect(contract.runtime.version).toBe('c11');
    expect(contract.runtime.supported).toBe(true);
    expect(contract.recipe.install).toEqual([
      ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main'],
    ]);
    expect(contract.recipe.run).toEqual(['./main']);
    expect(contract.recipe.test).toEqual([['valgrind', './main']]);
  });

  it('accepts a safe /app absolute executable returned by the planner for C projects', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        structuralType: 'T1',
        capabilities: {
          C1: { status: 'yes', rationale: 'Proyecto C compilable.' },
          C2: { status: 'yes', rationale: 'Entrada CLI detectable.' },
          C3: { status: 'no', rationale: 'No expone servicio persistente.' },
          C4: {
            status: 'yes',
            rationale: 'Puede validarse con pruebas batch.',
          },
          C5: { status: 'no', rationale: 'No aplica healthcheck.' },
          C6: { status: 'no', rationale: 'Sin configuracion externa.' },
        },
        runtime: {
          family: 'c',
          version: 'c11',
        },
        recipe: {
          install: [['gcc', '-Wall', 'main.c', '-o', 'calculator']],
          run: ['/app/calculator'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.run).toEqual(['/app/calculator']);
  });

  it('normalizes flat install and test commands into canonical command matrices', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        structuralType: 'T1',
        runtime: {
          family: 'c',
          version: 'c11',
        },
        recipe: {
          install: [
            'gcc',
            '-Wall',
            '-Wextra',
            '-std=c11',
            'main.c',
            '-o',
            'main',
          ],
          run: ['./main', '7', '8'],
          test: ['valgrind', './main', '7', '8'],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.install).toEqual([
      ['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main'],
    ]);
    expect(contract.recipe.run).toEqual(['./main', '7', '8']);
    expect(contract.recipe.test).toEqual([['valgrind', './main', '7', '8']]);
  });

  it('parses a service recipe with explicit service block', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        capabilities: {
          C1: { status: 'yes', rationale: 'Manifiesto detectado.' },
          C2: { status: 'yes', rationale: 'Servicio arrancable.' },
          C3: { status: 'yes', rationale: 'Expone API HTTP.' },
          C4: { status: 'yes', rationale: 'Suite pytest presente.' },
          C5: { status: 'yes', rationale: 'Healthcheck definido.' },
          C6: { status: 'no', rationale: 'Sin secretos externos.' },
        },
        recipe: {
          install: [['python', '-m', 'pip', 'install', '.']],
          run: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
          test: [['pytest']],
          systemPackages: ['curl'],
          cwd: '/app/src',
          environment: {
            UVICORN_WORKERS: '1',
          },
          service: {
            port: 8000,
            healthcheck: ['curl', '-sf', 'http://localhost:8000/health'],
          },
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.service).toEqual({
      port: 8000,
      healthcheck: ['curl', '-sf', 'http://localhost:8000/health'],
    });
    expect(contract.capabilities.C3.status).toBe('yes');
    expect(contract.capabilities.C5.status).toBe('yes');
  });

  it('coerces empty service metadata from CLI plans into a null service recipe', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        capabilities: {
          C1: { status: 'yes', rationale: 'Script ejecutable.' },
          C2: { status: 'yes', rationale: 'Punto de entrada detectado.' },
          C3: {
            status: 'yes',
            rationale: 'Marcado incorrectamente como servicio.',
          },
          C4: { status: 'yes', rationale: 'Sincroniza pruebas.' },
          C5: {
            status: 'yes',
            rationale: 'Marcado incorrectamente como healthcheck.',
          },
          C6: { status: 'no', rationale: 'Sin configuracion externa.' },
        },
        recipe: {
          install: [],
          run: ['python', 'main.py'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: {
            port: null,
            healthcheck: null,
          },
        },
        observedEvidence: [
          {
            file: 'main.py',
            content: 'CLI principal detectado.',
          },
          {
            file: 'utils.py',
            content: 'Modulo auxiliar detectado.',
          },
        ],
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.service).toBeNull();
    expect(contract.capabilities.C3.status).toBe('no');
    expect(contract.capabilities.C5.status).toBe('no');
    expect(contract.observedEvidence).toEqual([
      'main.py: CLI principal detectado.',
      'utils.py: Modulo auxiliar detectado.',
    ]);
  });

  it('rejects disallowed executables', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        recipe: {
          install: [],
          run: ['bash', 'start.sh'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    expect(() => parseBuilderPlanContractV2(raw)).toThrow(
      'Executable no permitido en recipe.run: bash',
    );
  });

  it('rejects semantic inconsistencies when an executable capability omits recipe.run', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        capabilities: {
          C1: { status: 'yes', rationale: 'Manifiesto detectado.' },
          C2: { status: 'yes', rationale: 'Punto de entrada detectado.' },
          C3: { status: 'yes', rationale: 'Declara servicio.' },
          C4: { status: 'yes', rationale: 'Tests presentes.' },
          C5: { status: 'no', rationale: 'Sin healthcheck.' },
          C6: { status: 'no', rationale: 'Sin configuración externa.' },
        },
        recipe: {
          install: [],
          run: null,
          test: [['pytest']],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: {
            port: 8000,
            healthcheck: null,
          },
        },
      }),
    );

    expect(() => parseBuilderPlanContractV2(raw)).toThrow(
      'C3=yes requiere recipe.run.',
    );
  });

  it('auto-corrects recipe.run when it starts with a build system executable', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        structuralType: 'T2',
        capabilities: {
          C1: { status: 'yes', rationale: 'Makefile presente.' },
          C2: { status: 'yes', rationale: 'Binario compilable.' },
          C3: { status: 'no', rationale: 'CLI sin servidor.' },
          C4: { status: 'unknown', rationale: 'Sin tests.' },
          C5: { status: 'no', rationale: 'Sin healthcheck.' },
          C6: { status: 'unknown', rationale: 'Sin config.' },
        },
        runtime: {
          family: 'c',
          version: 'c11',
        },
        recipe: {
          install: [['make']],
          run: ['make', 'all'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.run).toEqual(['./main']);
    expect(contract.evaluationLimits.length).toBeGreaterThan(0);
    expect(contract.evaluationLimits[0]).toContain('AUTO-CORRECTED');
  });

  it('does not auto-correct recipe.run when it is a valid local executable', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        structuralType: 'T2',
        runtime: {
          family: 'c',
          version: 'c11',
        },
        recipe: {
          install: [['make']],
          run: ['./main', '7', '8'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.recipe.run).toEqual(['./main', '7', '8']);
    expect(contract.evaluationLimits).toEqual([]);
  });

  it('marks non-python runtimes as declared but unsupported', () => {
    const raw = JSON.stringify(
      buildPlanPayload({
        runtime: {
          family: 'node',
          version: '20',
        },
      }),
    );

    const contract = parseBuilderPlanContractV2(raw);

    expect(contract.runtime.family).toBe('node');
    expect(contract.runtime.supported).toBe(false);
    expect(contract.runtime.reason).toContain('python');
  });
});
