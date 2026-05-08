import type { BuilderPlanContractV2 } from '../../domain/builder.types';
import { adaptPlanToRuntimeRecipe } from './builder-plan-runtime-adapter';

function buildPlanContract(overrides: Partial<BuilderPlanContractV2> = {}): BuilderPlanContractV2 {
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
});
