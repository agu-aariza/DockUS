import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import {
  OllamaGenerationService,
  OllamaModelProfile,
} from '../../../../../shared/infrastructure/ai/ollama-generation.service';
import { OllamaRequestError } from '../../../../../shared/infrastructure/ai/ollama-request.util';
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

function createProfile(
  stage: OllamaModelProfile['stage'],
  model: string,
): OllamaModelProfile {
  return {
    profileVersion: 'builder-llm-profile/v1',
    stage,
    model,
    baseModel:
      stage === 'plan' ? 'qwen2.5-coder:7b' : 'deepseek-r1:8b',
    numCtx: 24576,
    numPredict: stage === 'plan' ? 4096 : 8192,
    temperature: stage === 'quality' ? 0.2 : 0.1,
    topP: 0.9,
    repeatPenalty: 1.1,
    stopTokens: ['<|endoftext|>'],
    keepAliveSeconds: 300,
    timeoutMs: stage === 'plan' ? 120_000 : 180_000,
  };
}

describe('BuilderLlmEvaluatorService', () => {
  const promptRegistry = {
    getPrompt: jest.fn((id: string) => `${id.toUpperCase()}_PROMPT`),
  } as unknown as PromptRegistryService;

  const ollamaGenerationService = {
    generate: jest.fn(),
    getRuntimeConfig: jest.fn(() => ({
      baseUrl: 'http://ollama.test',
      timeoutMs: 1000,
    })),
  } as unknown as OllamaGenerationService;

  let service: BuilderLlmEvaluatorService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new BuilderLlmEvaluatorService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_OLLAMA_PLAN_MODEL':
              return 'plan-model';
            case 'BUILDER_OLLAMA_EVAL_MODEL':
              return 'eval-model';
            case 'BUILDER_LLM_PLAN_MAX_INPUT_CHARS':
              return 260;
            case 'BUILDER_LLM_EVAL_MAX_INPUT_CHARS':
              return 320;
            case 'OLLAMA_NUM_CTX':
              return 24576;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
      promptRegistry,
      new BuilderLogTrimmer(),
      ollamaGenerationService,
    );
  });

  it('builds the planner prompt with stable sections and preserves the oracle block', async () => {
    (ollamaGenerationService.generate as jest.Mock).mockResolvedValue(
      validPlanResponse,
    );

    await service.plan({
      sourceCodePayload: 'A'.repeat(2000),
      assignmentContext: {
        expectedType: 'C_CLI',
        rubricInstructions: 'Compila y ejecuta el binario.',
        expectedOutput: './main 7 8',
      },
    });

    expect(ollamaGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'plan',
        promptId: 'plan',
        systemPrompt: 'PLAN_PROMPT',
        profile: expect.objectContaining({
          model: 'plan-model',
          stage: 'plan',
          numCtx: 24576,
        }),
        prompt: expect.stringContaining('EXPECTED OUTPUT ORACLE'),
      }),
    );

    const plannerPrompt = (
      (ollamaGenerationService.generate as jest.Mock).mock.calls[0][0] as {
        prompt: string;
      }
    ).prompt;

    expect(plannerPrompt.length).toBeLessThanOrEqual(260);
    expect(plannerPrompt).toContain('./main 7 8');
    expect(plannerPrompt).toContain('STUDENT WORKSPACE');
  });

  it('runs the planner prompt hook before dispatching to Ollama and exposes prompt metadata', async () => {
    const callOrder: string[] = [];
    (ollamaGenerationService.generate as jest.Mock).mockImplementation(async () => {
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
          expect(modelProfile).toEqual(createProfile('plan', 'plan-model'));
          expect(sections.some((section) => section.label === 'STUDENT WORKSPACE')).toBe(true);
        },
      },
    );

    expect(callOrder).toEqual(['plan', 'generate']);
    expect(trace.parsedContract?.stage).toBe('plan');
  });

  it('builds the evaluation prompt with explicit evidence blocks instead of a free-form blob', async () => {
    (ollamaGenerationService.generate as jest.Mock).mockResolvedValue(
      validEvaluationResponse,
    );

    await service.evaluate({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'B'.repeat(2000),
      executionLogs: 'C'.repeat(2000),
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalua el proyecto.',
        expectedOutput: 'ok',
      },
    });

    expect(ollamaGenerationService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'evaluation',
        promptId: 'eval',
        systemPrompt: 'EVAL_PROMPT',
        profile: expect.objectContaining({
          model: 'eval-model',
          stage: 'evaluation',
          numCtx: 24576,
        }),
      }),
    );

    const evaluationPrompt = (
      (ollamaGenerationService.generate as jest.Mock).mock.calls[0][0] as {
        prompt: string;
      }
    ).prompt;

    expect(evaluationPrompt.length).toBeLessThanOrEqual(320);
    expect(evaluationPrompt).toContain('EXECUTION LOGS');
    expect(evaluationPrompt).toContain('PLANNER HYPOTHESIS');
    expect(evaluationPrompt).toContain('EXPECTED OUTPUT ORACLE');
  });

  it('captures raw evaluator output and serialized errors on parse failure', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    (ollamaGenerationService.generate as jest.Mock).mockResolvedValue(
      'still-not-json',
    );

    const trace = await service.evaluateWithTrace({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'print("hello")',
      executionLogs: 'traceback',
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

  it('serializes stage errors using prompt id, model profile, and runtime metadata', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    (ollamaGenerationService.generate as jest.Mock).mockRejectedValue(
      new OllamaRequestError({
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
      expect.stringContaining('"baseModel":"qwen2.5-coder:7b"'),
    );
  });
});
