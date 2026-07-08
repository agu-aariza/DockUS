import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { ILlmGenerationService } from '../../../../../shared/infrastructure/ai/llm-generation.token';
import { BedrockRequestError } from '../../../../../shared/infrastructure/ai/bedrock-request.util';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { BuilderLlmEvaluatorService } from './builder-llm-evaluator.service';

const validPlanResponse = JSON.stringify({
  schemaVersion: 'builder-llm/v2',
  stage: 'plan',
  thought: 'Plan valido.',
  structuralType: 'T4',
  capabilities: {
    C1: { status: 'yes', rationale: 'Manifest presente.' },
    C2: { status: 'yes', rationale: 'Entrada detectada.' },
    C3: { status: 'no', rationale: 'Sin servicio persistente.' },
    C4: { status: 'yes', rationale: 'Tests detectados.' },
    C5: { status: 'no', rationale: 'Sin healthcheck.' },
    C6: { status: 'no', rationale: 'Sin configuracion externa.' },
  },
  evaluativeState: 'E2',
  confidence: 'high',
  rationale: 'Plan consistente.',
  externalRequirements: [],
  runtime: {
    family: 'python',
    version: '3.11',
  },
  recipe: {
    install: [['python', '-m', 'pip', 'install', '.']],
    run: ['python', 'app.py'],
    test: [['pytest']],
    systemPackages: [],
    cwd: '/app',
    environment: null,
    service: null,
  },
  evidenceSummary: '',
  observedEvidence: [],
  evaluationLimits: [],
});

const validFactsResponse = JSON.stringify({
  schemaVersion: 'builder-llm/v2',
  stage: 'facts',
  thought: 'Hechos validos.',
  observedStdout: ['ok'],
  observedStderr: [],
  exitCode: 0,
  compilationStatus: 'not_applicable',
  matchesOracle: true,
  discrepancies: [],
  filesPresent: ['main.py'],
  executionSummary: 'El programa ejecuto correctamente.',
  evidenceLimits: [],
});

const validEvaluationResponse = JSON.stringify({
  schemaVersion: 'builder-llm/v2',
  stage: 'evaluation',
  thought: 'Eval valida.',
  structuralType: 'T4',
  capabilities: {
    C1: { status: 'yes', rationale: 'Manifest presente.' },
    C2: { status: 'yes', rationale: 'Ejecucion correcta.' },
    C3: { status: 'no', rationale: 'Sin servicio.' },
    C4: { status: 'yes', rationale: 'Tests ok.' },
    C5: { status: 'no', rationale: 'Sin healthcheck.' },
    C6: { status: 'no', rationale: 'Sin configuracion externa.' },
  },
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'Evaluacion consistente.',
  recommendedGrade: 8,
  externalRequirements: [],
  runtime: {
    family: 'python',
    version: '3.11',
  },
  recipe: {
    install: [['python', '-m', 'pip', 'install', '.']],
    run: ['python', 'app.py'],
    test: [['pytest']],
    systemPackages: [],
    cwd: '/app',
    environment: null,
    service: null,
  },
  evidenceSummary: 'Todo correcto.',
  observedEvidence: [
    'requirements.txt detectado.',
    'python app.py respondio sin error.',
    'pytest completo 2/2 tests.',
  ],
  evaluationLimits: [],
});

describe('BuilderLlmEvaluatorService', () => {
  const promptRegistry = {
    getPrompt: jest.fn((id: string) => `${id.toUpperCase()}_PROMPT`),
  } as unknown as PromptRegistryService;

  const llmService: jest.Mocked<ILlmGenerationService> = {
    generate: jest.fn(),
  };

  let service: BuilderLlmEvaluatorService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new BuilderLlmEvaluatorService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_BEDROCK_PLAN_MODEL_ID':
              return 'bedrock-plan-model';
            case 'BUILDER_BEDROCK_FACTS_MODEL_ID':
              return 'bedrock-facts-model';
            case 'BUILDER_BEDROCK_EVALUATION_MODEL_ID':
              return 'bedrock-eval-model';
            case 'BUILDER_LLM_PLAN_MAX_INPUT_CHARS':
              return 260;
            case 'BUILDER_LLM_FACTS_MAX_INPUT_CHARS':
              return 320;
            case 'BUILDER_LLM_EVAL_MAX_INPUT_CHARS':
              return 320;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
      promptRegistry,
      new BuilderLogTrimmer(),
      llmService as any,
    );
  });

  it('builds the planner prompt with stable sections and preserves the oracle block', async () => {
    llmService.generate.mockResolvedValue(validPlanResponse);

    await service.plan({
      sourceCodePayload: 'A'.repeat(2000),
      assignmentContext: {
        expectedType: 'C_CLI',
        rubricInstructions: 'Compila y ejecuta el binario.',
        expectedOutput: './main 7 8',
      },
    });

    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'plan',
        promptId: 'plan',
        systemPrompt: 'PLAN_PROMPT',
        profile: expect.objectContaining({
          modelId: 'bedrock-plan-model',
          stage: 'plan',
        }),
        prompt: expect.stringContaining('EXPECTED OUTPUT ORACLE'),
      }),
    );

    const plannerPrompt = (
      llmService.generate.mock.calls[0][0] as { prompt: string }
    ).prompt;

    expect(plannerPrompt.length).toBeLessThanOrEqual(260);
    expect(plannerPrompt).toContain('./main 7 8');
    expect(plannerPrompt).toContain('STUDENT WORKSPACE');
  });

  it('runs the planner prompt hook before dispatching and exposes prompt metadata', async () => {
    const callOrder: string[] = [];
    llmService.generate.mockImplementation(async () => {
      callOrder.push('generate');
      return validPlanResponse;
    });

    const trace = await service.planWithTrace(
      {
        sourceCodePayload: 'print("ok")',
        assignmentContext: {
          expectedType: 'PYTHON_FASTAPI',
          rubricInstructions: 'Evalua el proyecto.',
          expectedOutput: null,
        },
      },
      {
        onBeforeCall: ({ promptId, modelProfile, sections }) => {
          callOrder.push(promptId);
          expect(modelProfile).toEqual(
            expect.objectContaining({
              stage: 'plan',
              modelId: 'bedrock-plan-model',
            }),
          );
          expect(
            sections.some((section) => section.label === 'STUDENT WORKSPACE'),
          ).toBe(true);
        },
      },
    );

    expect(callOrder).toEqual(['plan', 'generate']);
    expect(trace.parsedContract?.stage).toBe('plan');
  });

  it('extracts facts before evaluation', async () => {
    llmService.generate.mockResolvedValue(validFactsResponse);

    await service.extractFacts({
      sourceCodePayload: 'B'.repeat(2000),
      executionLogs: 'C'.repeat(2000),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalua el proyecto.',
        expectedOutput: 'ok',
      },
    });

    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'facts',
        promptId: 'facts',
        systemPrompt: 'FACTS_PROMPT',
        profile: expect.objectContaining({
          modelId: 'bedrock-facts-model',
          stage: 'facts',
        }),
      }),
    );

    const factsPrompt = (
      llmService.generate.mock.calls[0][0] as { prompt: string }
    ).prompt;

    expect(factsPrompt.length).toBeLessThanOrEqual(320);
    expect(factsPrompt).toContain('EXECUTION LOGS');
    expect(factsPrompt).toContain('EXPECTED OUTPUT ORACLE');
  });

  it('builds the evaluation prompt with verified facts instead of raw logs', async () => {
    llmService.generate.mockResolvedValue(validEvaluationResponse);

    await service.evaluate({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'B'.repeat(2000),
      facts: JSON.parse(validFactsResponse),
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalua el proyecto.',
        expectedOutput: 'ok',
      },
    });

    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'evaluation',
        promptId: 'eval',
        systemPrompt: 'EVAL_PROMPT',
        profile: expect.objectContaining({
          modelId: 'bedrock-eval-model',
          stage: 'evaluation',
        }),
      }),
    );

    const evaluationPrompt = (
      llmService.generate.mock.calls[0][0] as { prompt: string }
    ).prompt;

    expect(evaluationPrompt.length).toBeLessThanOrEqual(320);
    expect(evaluationPrompt).toContain('VERIFIED FACTS');
    expect(evaluationPrompt).toContain('PLANNER HYPOTHESIS SUMMARY');
    expect(evaluationPrompt).toContain('EXPECTED OUTPUT ORACLE');
  });

  it('captures raw evaluator output and serialized errors on parse failure', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    llmService.generate.mockResolvedValue('still-not-json');

    const trace = await service.evaluateWithTrace({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'print("hello")',
      facts: JSON.parse(validFactsResponse),
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalua el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.rawResponse).toBe('still-not-json');
    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'La salida del evaluador LLM no es JSON válido.',
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Respuesta bruta: still-not-json'),
    );
  });

  it('serializes stage errors using prompt id and model profile metadata', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    llmService.generate.mockRejectedValue(
      new BedrockRequestError({
        code: 'model_not_found',
        message: 'El modelo no esta disponible.',
        httpStatus: 404,
      }),
    );

    const trace = await service.planWithTrace({
      sourceCodePayload: 'print("hello")',
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalua el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'model_not_found',
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"promptId":"plan"'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"modelId":"bedrock-plan-model"'),
    );
  });
});
