import type { BuilderPlanContractV2 } from './builder.types';
import {
  adaptPlanToRuntimeRecipe,
  BUILDER_RUNTIME_FAMILIES,
  isSupportedRuntimeFamily,
  matchRuntimeFamilyFromFreeText,
  normalizeRuntimeVersion,
  runtimeCatalogToText,
  RUNTIME_CATALOG,
  selectFewShotExample,
} from './runtime-catalog';

function buildPlanContract(
  overrides: Partial<BuilderPlanContractV2> = {},
): BuilderPlanContractV2 {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'plan',
    thought: 'Plan Python base.',
    structuralType: 'T4',
    capabilities: {
      C1: { status: 'yes', rationale: 'Manifest presente.' },
      C2: { status: 'yes', rationale: 'Punto de entrada disponible.' },
      C3: { status: 'yes', rationale: 'Expone servicio.' },
      C4: { status: 'yes', rationale: 'Tests presentes.' },
      C5: { status: 'yes', rationale: 'Healthcheck presente.' },
      C6: { status: 'no', rationale: 'Sin configuración externa.' },
    },
    evaluativeState: 'E2',
    confidence: 'high',
    rationale: 'Plan consistente.',
    externalRequirements: [],
    runtime: {
      family: 'python',
      version: '3.11',
      supported: true,
      reason: null,
    },
    recipe: {
      install: [['python', '-m', 'pip', 'install', '.']],
      run: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
      test: [['pytest']],
      systemPackages: ['curl'],
      cwd: '/app/src',
      environment: {
        APP_ENV: 'test',
      },
      service: {
        port: 8000,
        healthcheck: ['curl', '-sf', 'http://localhost:8000/health'],
      },
    },
    evidenceSummary: '',
    observedEvidence: [],
    evaluationLimits: [],
    ...overrides,
  };
}

describe('adaptPlanToRuntimeRecipe', () => {
  it('adapts a Python plan into the current runtime shape', () => {
    const adapted = adaptPlanToRuntimeRecipe(buildPlanContract());

    expect(adapted.executable).toBe(true);
    expect(adapted.runtimeVersion).toBe('3.11');
    expect(adapted.run).toEqual([
      'uvicorn',
      'main:app',
      '--host',
      '0.0.0.0',
      '--port',
      '8000',
    ]);
    expect(adapted.healthcheck).toEqual([
      'curl',
      '-sf',
      'http://localhost:8000/health',
    ]);
    expect(adapted.servicePort).toBe(8000);
  });

  it('transfers cwd and environment safely to runtime execution', () => {
    const adapted = adaptPlanToRuntimeRecipe(buildPlanContract());

    expect(adapted.workingDirectory).toBe('/app/src');
    expect(adapted.environment).toEqual({ APP_ENV: 'test' });
  });

  it('adapts a C plan into an executable runtime recipe', () => {
    const adapted = adaptPlanToRuntimeRecipe(
      buildPlanContract({
        runtime: {
          family: 'c',
          version: 'c11',
          supported: true,
          reason: null,
        },
        recipe: {
          install: [['gcc', '-Wall', 'main.c', '-o', 'main']],
          run: ['./main'],
          test: [['valgrind', './main']],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
      }),
    );

    expect(adapted.executable).toBe(true);
    expect(adapted.runtimeFamily).toBe('c');
    expect(adapted.runtimeVersion).toBe('c11');
    expect(adapted.run).toEqual(['./main']);
    expect(adapted.install).toEqual([['gcc', '-Wall', 'main.c', '-o', 'main']]);
  });

  it('preserves a safe /app absolute executable for C runtime execution', () => {
    const adapted = adaptPlanToRuntimeRecipe(
      buildPlanContract({
        runtime: {
          family: 'c',
          version: 'c11',
          supported: true,
          reason: null,
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

    expect(adapted.executable).toBe(true);
    expect(adapted.run).toEqual(['/app/calculator']);
  });

  it('prevents unsupported runtimes from reaching execution', () => {
    const adapted = adaptPlanToRuntimeRecipe(
      buildPlanContract({
        runtime: {
          family: 'node',
          version: '20',
          supported: false,
          reason: 'Solo Python es ejecutable en esta iteración.',
        },
      }),
    );

    expect(adapted.executable).toBe(false);
    expect(adapted.run).toBeNull();
    expect(adapted.unsupportedReason).toContain('Python');
  });

  it('node no es ejecutable aunque el plan lo marque como soportado (ARQ-010: viene del catálogo, no de una copia)', () => {
    const adapted = adaptPlanToRuntimeRecipe(
      buildPlanContract({
        runtime: {
          family: 'node',
          version: '20',
          supported: true,
          reason: null,
        },
        recipe: {
          install: [['npm', 'install']],
          run: ['node', 'index.js'],
          test: [],
          systemPackages: [],
          cwd: null,
          environment: null,
          service: null,
        },
      }),
    );

    expect(adapted.executable).toBe(false);
  });
});

describe('BUILDER_RUNTIME_FAMILIES (ARQ-010)', () => {
  it('se deriva de las claves del catálogo más el centinela unknown', () => {
    expect(BUILDER_RUNTIME_FAMILIES).toEqual([
      'python',
      'c',
      'node',
      'unknown',
    ]);
  });

  it('isSupportedRuntimeFamily distingue las familias del catálogo de unknown', () => {
    expect(isSupportedRuntimeFamily('python')).toBe(true);
    expect(isSupportedRuntimeFamily('c')).toBe(true);
    expect(isSupportedRuntimeFamily('node')).toBe(true);
    expect(isSupportedRuntimeFamily('unknown')).toBe(false);
  });
});

describe('normalizeRuntimeVersion (ARQ-010)', () => {
  it('conserva una versión ya soportada', () => {
    expect(normalizeRuntimeVersion('python', '3.10')).toBe('3.10');
  });

  it('cae a la versión por defecto de la familia si no es soportada', () => {
    expect(normalizeRuntimeVersion('python', '2.7')).toBe(
      RUNTIME_CATALOG.python.defaultVersion,
    );
    expect(normalizeRuntimeVersion('node', '8')).toBe(
      RUNTIME_CATALOG.node.defaultVersion,
    );
  });

  it('resuelve alias de versión de C antes de validar', () => {
    expect(normalizeRuntimeVersion('c', 'gcc-13')).toBe('c17');
    expect(normalizeRuntimeVersion('c', 'GNU11')).toBe('c11');
  });

  it('cae al default de C si no es alias ni versión soportada', () => {
    expect(normalizeRuntimeVersion('c', 'c89')).toBe(
      RUNTIME_CATALOG.c.defaultVersion,
    );
  });

  it('no valida familias fuera del catálogo (unknown)', () => {
    expect(normalizeRuntimeVersion('unknown', 'cualquier-cosa')).toBe(
      'cualquier-cosa',
    );
  });
});

describe('runtimeCatalogToText', () => {
  it('incluye las tres familias del catálogo con su imagen y versiones', () => {
    const text = runtimeCatalogToText();
    expect(text).toContain('python');
    expect(text).toContain('python:3.11-slim');
    expect(text).toContain('c');
    expect(text).toContain('node');
  });
});

describe('matchRuntimeFamilyFromFreeText (ARQ-010 resto)', () => {
  it('detecta python por alias exacto', () => {
    expect(matchRuntimeFamilyFromFreeText('CLI Python')).toBe('python');
    expect(matchRuntimeFamilyFromFreeText('PYTHON_FASTAPI')).toBe('python');
  });

  it('detecta c por alias exacto', () => {
    expect(matchRuntimeFamilyFromFreeText('C_CLI')).toBe('c');
    expect(matchRuntimeFamilyFromFreeText('GCC batch job')).toBe('c');
  });

  it('no dispara la familia c por contener la letra "c" dentro de otra palabra (bug original)', () => {
    // "PYTHON_CLI" tokeniza a ["python", "cli"]: ningún token es "c", así
    // que ya no cae en el falso positivo que tenía el .includes('c') previo.
    expect(matchRuntimeFamilyFromFreeText('PYTHON_CLI')).toBe('python');
    expect(matchRuntimeFamilyFromFreeText('Flask API service')).toBe(null);
  });

  it('devuelve null si ningún alias coincide', () => {
    expect(matchRuntimeFamilyFromFreeText('')).toBe(null);
    expect(matchRuntimeFamilyFromFreeText('Rust CLI')).toBe(null);
  });
});

describe('selectFewShotExample (ARQ-010 resto)', () => {
  it('prioriza el ejemplo de servicio de Python ante frameworks conocidos, sin mencionar "python"', () => {
    expect(selectFewShotExample('Flask API')).toContain('service');
    expect(selectFewShotExample('PYTHON_FASTAPI')).toContain('service');
  });

  it('devuelve el ejemplo CLI de C para expectedType con alias de C', () => {
    expect(selectFewShotExample('C_CLI')).toContain('"family": "c"');
  });

  it('ya no confunde "PYTHON_CLI" con C (regresión del bug original .includes("c"))', () => {
    expect(selectFewShotExample('PYTHON_CLI')).toContain('"family": "python"');
    expect(selectFewShotExample('PYTHON_CLI')).not.toContain('"family": "c"');
  });

  it('cae al ejemplo CLI de Python por defecto si expectedType es null o no reconocido', () => {
    expect(selectFewShotExample(null)).toContain('"family": "python"');
    expect(selectFewShotExample('Rust batch worker')).toContain(
      '"family": "python"',
    );
  });
});
