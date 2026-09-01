import { BuilderHallucinationGuard } from '@app/modules/projects/builder/application/services/evaluation/builder-hallucination-guard.service';
import {
  BuilderEvaluationContractV2,
  BuilderExecutionResult,
} from '@app/modules/projects/builder/domain/builder.types';

describe('BuilderHallucinationGuard', () => {
  const guard = new BuilderHallucinationGuard();

  const buildAssessment = (
    evaluativeState: BuilderEvaluationContractV2['evaluativeState'],
  ): BuilderEvaluationContractV2 => ({
    schemaVersion: 'builder-llm/v2',
    stage: 'evaluation',
    thought: 'ok',
    structuralType: 'cli',
    capabilities: {
      C1: { status: 'yes', rationale: 'ok' },
      C2: { status: 'yes', rationale: 'ok' },
      C3: { status: 'no', rationale: 'ok' },
      C4: { status: 'yes', rationale: 'ok' },
      C5: { status: 'no', rationale: 'ok' },
      C6: { status: 'no', rationale: 'ok' },
    },
    evaluativeState,
    confidence: 'high',
    rationale: 'ok',
    externalRequirements: [],
    runtime: { family: 'python', version: null, supported: true, reason: null },
    recipe: {
      install: [],
      run: null,
      test: [],
      systemPackages: [],
      cwd: null,
      environment: null,
      service: null,
    },
    evidenceSummary: '',
    observedEvidence: [],
    evaluationLimits: [],
    gradeBreakdown: [],
    studentSummary: '',
    teacherSummary: '',
  });

  const buildExecution = (
    overrides: Partial<BuilderExecutionResult> = {},
  ): BuilderExecutionResult => ({
    ran: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
    ...overrides,
  });

  it('no evalua nada si el proyecto no llego a ejecutarse', () => {
    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({ ran: false }),
      null,
    );
    expect(result).toBeNull();
  });

  it('detecta alucinacion cuando los logs solo tienen artefactos de build pero el estado es E1', () => {
    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({
        stdout: 'gcc -o main main.c\nmake: Nothing to be done',
      }),
      null,
    );
    expect(result).toContain('GUARDRAIL');
    expect(result).toContain('E1');
  });

  it('no marca alucinacion si el estado degradado ya es E3/E4 aunque solo haya logs de build', () => {
    const result = guard.detectOutputHallucination(
      buildAssessment('E3'),
      buildExecution({ stdout: 'gcc -o main main.c' }),
      null,
    );
    expect(result).toBeNull();
  });

  it('no marca alucinacion cuando el stdout tiene salida real de programa', () => {
    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({ stdout: 'Resultado: 42' }),
      null,
    );
    expect(result).toBeNull();
  });

  it('detecta alucinacion si ninguna linea del expectedOutput aparece en la salida real', () => {
    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({ stdout: 'Algo completamente distinto ocurrio aqui' }),
      'Se espera exactamente: 42 unidades procesadas correctamente',
    );
    expect(result).toContain('GUARDRAIL');
    expect(result).toContain('expectedOutput');
  });

  it('no marca alucinacion si alguna linea del expectedOutput aparece en la salida real', () => {
    const expectedOutput =
      'Instrucciones generales del ejercicio.\n42 unidades procesadas correctamente\nOtra linea de contexto';
    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({ stdout: '42 unidades procesadas correctamente' }),
      expectedOutput,
    );
    expect(result).toBeNull();
  });

  it('detecta alucinacion por desajuste numerico contra la salida exacta esperada del oraculo', () => {
    // La linea de contexto debe aparecer tal cual en stdout para superar el
    // check 2 (alguna linea del oraculo presente) y llegar al check 3
    // (comparacion numerica de la seccion "Salida exacta esperada").
    const expectedOutput = [
      'Contexto del ejercicio.',
      '',
      'Salida exacta esperada:',
      'Total: 10',
      'Media: 5',
    ].join('\n');

    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({
        stdout: 'Contexto del ejercicio.\nTotal: 99\nMedia: 77',
      }),
      expectedOutput,
    );
    expect(result).toContain('GUARDRAIL');
    expect(result).toContain('alucinacion confirmada');
  });

  it('no marca desajuste numerico si los valores coinciden con el oraculo', () => {
    const expectedOutput = ['Salida exacta esperada:', 'Total: 10'].join('\n');

    const result = guard.detectOutputHallucination(
      buildAssessment('E1'),
      buildExecution({ stdout: 'Total: 10' }),
      expectedOutput,
    );
    expect(result).toBeNull();
  });
});
