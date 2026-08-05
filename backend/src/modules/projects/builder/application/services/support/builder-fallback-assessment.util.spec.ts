/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-fallback-assessment.util.spec).
 *
 * @module builder-fallback-assessment.util.spec
 */

import { resolveEvaluationAssessment } from './builder-fallback-assessment.util';
import { BuilderHallucinationGuard } from '../evaluation/builder-hallucination-guard.service';
import {
  BUILDER_LLM_SCHEMA_VERSION,
  type BuilderEvaluationContractV2,
  type BuilderExecutionResult,
  type BuilderLlmStageTrace,
  type BuilderPlanContractV2,
} from '../../../domain/builder.types';

const planAssessment: BuilderPlanContractV2 = {
  schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
  stage: 'plan',
  thought: 'plan checked',
  structuralType: 'T2',
  capabilities: {
    C1: { status: 'yes', rationale: 'Proyecto identificado.' },
    C2: { status: 'yes', rationale: 'Entrada ejecutable.' },
    C3: { status: 'no', rationale: 'No expone servicio.' },
    C4: { status: 'no', rationale: 'Sin pruebas.' },
    C5: { status: 'no', rationale: 'Sin healthcheck.' },
    C6: { status: 'unknown', rationale: 'Sin configuración externa.' },
  },
  evaluativeState: 'E2',
  confidence: 'medium',
  rationale: 'Proyecto C con Makefile.',
  externalRequirements: [],
  runtime: { family: 'c', version: 'c11', supported: true, reason: null },
  recipe: {
    install: [['make']],
    run: ['./main'],
    test: [],
    systemPackages: ['build-essential'],
    cwd: '/app',
    environment: null,
    service: null,
  },
  evidenceSummary: 'Proyecto C con Makefile.',
  observedEvidence: ['Makefile presente'],
  evaluationLimits: [],
};

const execution: BuilderExecutionResult = {
  ran: true,
  stdout: '56 62\n38 44\n',
  stderr: '',
  exitCode: 0,
};

function buildTrace(
  parsedContract: BuilderEvaluationContractV2 | null,
): BuilderLlmStageTrace<BuilderEvaluationContractV2> {
  return {
    stage: 'evaluation',
    promptId: 'eval',
    model: 'test-model',
    systemPrompt: null,
    prompt: 'prompt',
    sections: [],
    modelProfile: {
      profileVersion: 'v1',
      stage: 'evaluation',
      providerId: 'bedrock',
      modelId: 'test-model',
      maxTokens: 4096,
      temperature: 0,
      topP: 1,
      stopSequences: [],
      timeoutMs: 60_000,
    },
    createdAt: new Date().toISOString(),
    schemaVersion: BUILDER_LLM_SCHEMA_VERSION,
    rawResponse: parsedContract ? JSON.stringify(parsedContract) : 'no-json',
    parsedContract,
    error: parsedContract
      ? null
      : {
          name: 'Error',
          code: 'invalid_contract',
          message: 'El contrato devuelto no es JSON válido.',
          stack: null,
          timestamp: new Date().toISOString(),
        },
  };
}

describe('resolveEvaluationAssessment', () => {
  const guard = new BuilderHallucinationGuard();

  it('marca la evaluación degradada como E4, no como E3', () => {
    const assessment = resolveEvaluationAssessment(
      buildTrace(null),
      planAssessment,
      execution,
      null,
      guard,
    );

    // E3 significa "el programa no produjo salida evaluable" — un problema de la
    // entrega. Aquí el programa se ejecutó bien y quien falló fue el evaluador,
    // así que el estado honesto es E4 ("no se pudo evaluar"). Ambos mapean a
    // FAIL y al mismo tope de nota: cambia el relato, no el resultado.
    expect(assessment.evaluativeState).toBe('E4');
    expect(assessment.confidence).toBe('low');
    expect(assessment.recommendedGrade).toBeUndefined();
    expect(assessment.evaluationLimits.join('\n')).toContain(
      'Contrato inválido del evaluador LLM',
    );
  });

  it('degrada a E3 cuando el evaluador se inventó salida que no está en los logs', () => {
    const hallucinated: BuilderEvaluationContractV2 = {
      ...planAssessment,
      stage: 'evaluation',
      evaluativeState: 'E1',
      confidence: 'high',
      recommendedGrade: 9,
      gradeBreakdown: [],
      studentSummary: 'Todo correcto.',
      teacherSummary: 'Todo correcto.',
    };

    const assessment = resolveEvaluationAssessment(
      buildTrace(hallucinated),
      planAssessment,
      // Solo mensajes de compilación: no hay salida de programa que respalde E1.
      {
        ran: true,
        stdout: 'gcc -Wall main.c -o main\n',
        stderr: '',
        exitCode: 0,
      },
      null,
      guard,
    );

    expect(assessment.evaluativeState).toBe('E3');
    expect(assessment.confidence).toBe('low');
  });

  it('corrige a E1 un E2 cuya rúbrica no descuenta un solo punto', () => {
    const perfect: BuilderEvaluationContractV2 = {
      ...planAssessment,
      stage: 'evaluation',
      evaluativeState: 'E2',
      confidence: 'high',
      recommendedGrade: 10,
      gradeBreakdown: [
        {
          criterion: 'Salida correcta',
          maxPoints: 6,
          awarded: 6,
          justification: 'La salida coincide con el oráculo.',
        },
        {
          criterion: 'Suite docente',
          maxPoints: 4,
          awarded: 4,
          justification: '13/13 comprobaciones superadas.',
        },
      ],
      studentSummary: 'Buen trabajo.',
      teacherSummary: 'Entrega validada.',
    };

    const assessment = resolveEvaluationAssessment(
      buildTrace(perfect),
      planAssessment,
      execution,
      null,
      guard,
    );

    expect(assessment.evaluativeState).toBe('E1');
  });

  it('respeta E2 cuando el desglose sí descuenta puntos', () => {
    const partial: BuilderEvaluationContractV2 = {
      ...planAssessment,
      stage: 'evaluation',
      evaluativeState: 'E2',
      confidence: 'high',
      recommendedGrade: 7,
      gradeBreakdown: [
        {
          criterion: 'Salida correcta',
          maxPoints: 6,
          awarded: 3,
          justification: 'Los valores no coinciden con el oráculo.',
        },
        {
          criterion: 'Suite docente',
          maxPoints: 4,
          awarded: 4,
          justification: 'Comprobaciones superadas.',
        },
      ],
      studentSummary: 'Revisa el cálculo.',
      teacherSummary: 'Salida incorrecta.',
    };

    const assessment = resolveEvaluationAssessment(
      buildTrace(partial),
      planAssessment,
      execution,
      null,
      guard,
    );

    expect(assessment.evaluativeState).toBe('E2');
  });

  it('respeta el contrato del evaluador cuando la evidencia lo sostiene', () => {
    const valid: BuilderEvaluationContractV2 = {
      ...planAssessment,
      stage: 'evaluation',
      evaluativeState: 'E1',
      confidence: 'high',
      recommendedGrade: 10,
      gradeBreakdown: [],
      studentSummary: 'Buen trabajo.',
      teacherSummary: 'Entrega validada.',
    };

    const assessment = resolveEvaluationAssessment(
      buildTrace(valid),
      planAssessment,
      execution,
      null,
      guard,
    );

    expect(assessment.evaluativeState).toBe('E1');
    expect(assessment.recommendedGrade).toBe(10);
  });
});
