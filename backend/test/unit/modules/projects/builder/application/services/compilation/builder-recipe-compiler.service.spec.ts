import { BuilderRecipeCompiler } from '@app/modules/projects/builder/application/services/compilation/builder-recipe-compiler.service';
import { BuilderPlanContractV2 } from '@app/modules/projects/builder/domain/builder.types';

function buildPlan(
  runtimeFamily: 'c' | 'python',
  install: string[][] = [],
  run: string[] = runtimeFamily === 'c' ? ['./main'] : ['python', 'main.py'],
  test: string[][] = [],
): BuilderPlanContractV2 {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'plan',
    thought: 'Plan de prueba.',
    structuralType: 'T2',
    capabilities: {
      C1: { status: 'yes', rationale: 'Punto de entrada presente.' },
      C2: { status: 'yes', rationale: 'CLI ejecutable.' },
      C3: { status: 'no', rationale: 'No es un servicio.' },
      C4: { status: 'yes', rationale: 'Suite disponible.' },
      C5: { status: 'no', rationale: 'No aplica.' },
      C6: { status: 'no', rationale: 'Sin configuración externa.' },
    },
    evaluativeState: 'E1',
    confidence: 'high',
    rationale: 'Plan de prueba.',
    externalRequirements: [],
    runtime: {
      family: runtimeFamily,
      version: runtimeFamily === 'c' ? 'c11' : '3.11',
      supported: true,
      reason: null,
    },
    recipe: {
      install,
      run,
      test,
      systemPackages: [],
      cwd: '/app',
      environment: null,
      service: null,
    },
    evidenceSummary: '',
    observedEvidence: [],
    evaluationLimits: [],
  };
}

describe('BuilderRecipeCompiler', () => {
  const compiler = new BuilderRecipeCompiler();

  it('ejecuta automáticamente el runner docente C en lugar de lanzar el CLI sin stdin', () => {
    const compiled = compiler.compile(
      buildPlan('c', [['gcc', '-std=c11', 'main.c', '-lm', '-o', 'main']]),
      [{ relativePath: 'main.c' }],
      [
        { relativePath: '.educodeai/teacher-tests/run_suite.sh' },
        { relativePath: '.educodeai/teacher-tests/casos/caso-basico.in' },
      ],
    );

    expect(compiled.teacherSuiteRunner).toBe('c');
    expect(compiled.testCmd).toBe(
      'sh /app/.educodeai/teacher-tests/run_suite.sh /app',
    );
    expect(compiled.orchestratedCmd).toContain(
      'gcc -std=c11 main.c -lm -o main && sh /app/.educodeai/teacher-tests/run_suite.sh /app',
    );
    expect(compiled.orchestratedCmd).not.toContain('./main &&');
  });

  it('ejecuta automáticamente el runner docente Python', () => {
    const compiled = compiler.compile(
      buildPlan('python'),
      [{ relativePath: 'main.py' }],
      [{ relativePath: '.educodeai/teacher-tests/run_suite.py' }],
    );

    expect(compiled.teacherSuiteRunner).toBe('python');
    expect(compiled.finalCommand).toEqual([
      'sh',
      '-c',
      'python /app/.educodeai/teacher-tests/run_suite.py /app',
    ]);
  });

  it('mantiene la ejecución normal cuando no hay runner docente reconocido', () => {
    const compiled = compiler.compile(
      buildPlan('python', [], ['python', 'main.py'], [['pytest', '-q']]),
      [{ relativePath: 'main.py' }],
      [{ relativePath: '.educodeai/teacher-tests/README.md' }],
    );

    expect(compiled.teacherSuiteRunner).toBeNull();
    expect(compiled.orchestratedCmd).toBe('python main.py && pytest -q');
  });
});
