import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BuilderLogTrimmer } from '../../infrastructure/utils/builder-log-trimmer.util';
import { BuilderLlmEvaluatorService } from './builder-llm-evaluator.service';

const validPlanResponse = JSON.stringify({
  schemaVersion: 'builder-llm/v2',
  stage: 'plan',
  thought: 'Plan válido.',
  structuralType: 'T4',
  capabilities: {
    C1: { status: 'yes', rationale: 'Manifest presente.' },
    C2: { status: 'yes', rationale: 'Entrada detectada.' },
    C3: { status: 'no', rationale: 'Sin servicio persistente.' },
    C4: { status: 'yes', rationale: 'Tests detectados.' },
    C5: { status: 'no', rationale: 'Sin healthcheck.' },
    C6: { status: 'no', rationale: 'Sin configuración externa.' },
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
  thought: 'Eval válida.',
  structuralType: 'T4',
  capabilities: {
    C1: { status: 'yes', rationale: 'Manifest presente.' },
    C2: { status: 'yes', rationale: 'Ejecución correcta.' },
    C3: { status: 'no', rationale: 'Sin servicio.' },
    C4: { status: 'yes', rationale: 'Tests ok.' },
    C5: { status: 'no', rationale: 'Sin healthcheck.' },
    C6: { status: 'no', rationale: 'Sin configuración externa.' },
  },
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'Evaluación consistente.',
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
    'python app.py respondió sin error.',
    'pytest completó 2/2 tests.',
  ],
  evaluationLimits: [],
});

describe('BuilderLlmEvaluatorService', () => {
  const fetchMock = jest.fn();
  const promptRegistry = {
    getPrompt: jest.fn((id: string) => `${id.toUpperCase()}_PROMPT`),
  } as unknown as PromptRegistryService;

  let service: BuilderLlmEvaluatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new BuilderLlmEvaluatorService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_OLLAMA_BASE_URL':
              return 'http://ollama.test';
            case 'BUILDER_OLLAMA_PLAN_MODEL':
              return 'plan-model';
            case 'BUILDER_OLLAMA_EVAL_MODEL':
              return 'eval-model';
            case 'BUILDER_OLLAMA_TIMEOUT_MS':
              return 1000;
            case 'BUILDER_LLM_PLAN_MAX_INPUT_CHARS':
              return 120;
            case 'BUILDER_LLM_EVAL_MAX_INPUT_CHARS':
              return 160;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
      promptRegistry,
      new BuilderLogTrimmer(),
    );
  });

  it('truncates the planner payload before calling the model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validPlanResponse }),
    });

    await service.plan({
      sourceCodePayload: 'A'.repeat(2000),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { prompt: string };

    expect(body.prompt.length).toBeLessThanOrEqual(120);
  });

  it('runs the planner prompt hook before calling the model', async () => {
    const callOrder: string[] = [];
    fetchMock.mockImplementation(async () => {
      callOrder.push('fetch');
      return {
        ok: true,
        json: async () => ({ response: validPlanResponse }),
      };
    });

    const trace = await service.planWithTrace(
      {
        sourceCodePayload: 'A'.repeat(2000),
        assignmentContext: {
          expectedType: 'PYTHON_FASTAPI',
          rubricInstructions: 'Evalúa el proyecto.',
          expectedOutput: null,
        },
      },
      {
        onBeforeCall: async ({ stage, model, prompt }) => {
          callOrder.push(`${stage}:${model}`);
          expect(prompt.length).toBeLessThanOrEqual(120);
        },
      },
    );

    expect(callOrder).toEqual(['plan:plan-model', 'fetch']);
    expect(trace.parsedContract?.stage).toBe('plan');
  });

  it('includes the expected output oracle in the planner prompt when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validPlanResponse }),
    });

    await service.plan({
      sourceCodePayload: 'int main(void) { return 0; }',
      assignmentContext: {
        expectedType: 'C_CLI',
        rubricInstructions: 'Compila y ejecuta el binario.',
        expectedOutput: './main 7 8',
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { prompt: string };

    expect(body.prompt).toContain('Salida esperada (Oráculo)');
    expect(body.prompt).toContain('./main 7 8');
  });

  it('truncates the evaluation payload before calling the model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validEvaluationResponse }),
    });

    await service.evaluate({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'B'.repeat(2000),
      executionLogs: 'C'.repeat(2000),
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { prompt: string };

    expect(body.prompt.length).toBeLessThanOrEqual(160);
  });

  it('includes the planner hypothesis in the evaluation prompt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validEvaluationResponse }),
    });

    await service.evaluate({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'print("ok")',
      executionLogs: 'STDOUT:\nok',
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: 'ok',
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { prompt: string };

    expect(body.prompt).toContain('Hipótesis del planner');
    expect(body.prompt).toContain('"schemaVersion": "builder-llm/v2"');
    expect(body.prompt).toContain('...[truncated]');
  });

  it('returns the raw planner response alongside the parsed contract', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validPlanResponse }),
    });

    const trace = await service.planWithTrace({
      sourceCodePayload: 'print("hello")',
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.model).toBe('plan-model');
    expect(trace.rawResponse).toBe(validPlanResponse);
    expect(trace.parsedContract?.schemaVersion).toBe('builder-llm/v2');
    expect(trace.error).toBeNull();
  });

  it('logs the raw planner response when parsing fails', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'not-json' }),
    });

    await expect(
      service.plan({
        sourceCodePayload: 'print("hello")',
        assignmentContext: {
          expectedType: 'PYTHON_FASTAPI',
          rubricInstructions: 'Evalúa el proyecto.',
          expectedOutput: null,
        },
      }),
    ).rejects.toThrow('La salida del planner LLM no es JSON válido.');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Respuesta bruta: not-json'),
    );
  });

  it('logs the raw evaluator response when parsing fails', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'still-not-json' }),
    });

    await expect(
      service.evaluate({
        projectRootDir: '/tmp/project',
        sourceCodePayload: 'print("hello")',
        executionLogs: 'traceback',
        plannerAssessment: JSON.parse(validPlanResponse),
        assignmentContext: {
          expectedType: 'PYTHON_FASTAPI',
          rubricInstructions: 'Evalúa el proyecto.',
          expectedOutput: null,
        },
      }),
    ).rejects.toThrow('La salida del evaluador LLM no es JSON válido.');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Respuesta bruta: still-not-json'),
    );
  });

  it('captures raw evaluator output and serialized error details on parse failure', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'still-not-json' }),
    });

    const trace = await service.evaluateWithTrace({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'print("hello")',
      executionLogs: 'traceback',
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
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

  it('classifies Ollama connectivity failures with baseUrl context', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const trace = await service.planWithTrace({
      sourceCodePayload: 'print("hello")',
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'connectivity',
        message: expect.stringContaining('http://ollama.test'),
      }),
    );
  });

  it('classifies missing planner models as model_not_found', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "model 'plan-model' not found",
    });

    const trace = await service.planWithTrace({
      sourceCodePayload: 'print("hello")',
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'model_not_found',
        httpStatus: 404,
        message: expect.stringContaining('plan-model'),
      }),
    );
  });

  it('classifies malformed Ollama payloads as invalid_response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: { unexpected: true } }),
    });

    const trace = await service.evaluateWithTrace({
      projectRootDir: '/tmp/project',
      sourceCodePayload: 'print("hello")',
      executionLogs: 'traceback',
      plannerAssessment: JSON.parse(validPlanResponse),
      assignmentContext: {
        expectedType: 'PYTHON_FASTAPI',
        rubricInstructions: 'Evalúa el proyecto.',
        expectedOutput: null,
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'invalid_response',
        message: 'Respuesta de evaluación LLM sin campo response string.',
      }),
    );
  });
});
