import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '../../../../../shared/infrastructure/ai/prompt-registry.service';
import { BuilderCodeQualityService } from './builder-code-quality.service';

const validQualityResponse = JSON.stringify({
  thought: 'Calidad consistente.',
  security: [
    {
      title: 'sprintf inseguro',
      detail:
        'Observación: se usa sprintf. Impacto: riesgo de desbordamiento. Recomendación: usa snprintf.',
      severity: 'high',
      file: 'main.c',
      line: 8,
    },
  ],
  architecture: [],
  quality: [],
  rubricCompliance: [],
});

describe('BuilderCodeQualityService', () => {
  const fetchMock = jest.fn();
  const promptRegistry = {
    getPrompt: jest.fn(() => 'TECHNICAL_FEEDBACK_PROMPT'),
  } as unknown as PromptRegistryService;

  let service: BuilderCodeQualityService;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new BuilderCodeQualityService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_OLLAMA_BASE_URL':
              return 'http://ollama.test';
            case 'BUILDER_OLLAMA_QUALITY_MODEL':
              return 'quality-model';
            case 'BUILDER_OLLAMA_TIMEOUT_MS':
              return 1000;
            case 'BUILDER_LLM_QUALITY_MAX_INPUT_CHARS':
              return 150;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
      promptRegistry,
    );
  });

  it('captures prompt, raw response and parsed contract during code quality analysis', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: validQualityResponse }),
    });

    const trace = await service.analyzeWithTrace(
      {
        sourceCodePayload: 'A'.repeat(2000),
        executionLogs: 'B'.repeat(2000),
        assignmentContext: {
          expectedType: 'C_CLI',
          rubricInstructions: 'Evalúa mantenibilidad y seguridad.',
          expectedOutput: null,
        },
        assessment: {
          schemaVersion: 'builder-llm/v2',
          stage: 'evaluation',
          thought: 'Eval.',
          structuralType: 'T2',
          capabilities: {
            C1: { status: 'yes', rationale: 'Manifest.' },
            C2: { status: 'yes', rationale: 'Entrada.' },
            C3: { status: 'no', rationale: 'CLI.' },
            C4: { status: 'yes', rationale: 'Tests.' },
            C5: { status: 'no', rationale: 'Sin healthcheck.' },
            C6: { status: 'no', rationale: 'Sin config.' },
          },
          evaluativeState: 'E1',
          confidence: 'high',
          rationale: 'Ok',
          recommendedGrade: 8,
          externalRequirements: [],
          runtime: {
            family: 'c',
            version: 'c11',
            supported: true,
            reason: null,
          },
          recipe: {
            install: [],
            run: ['./main'],
            test: [],
            systemPackages: [],
            cwd: '/app',
            environment: null,
            service: null,
          },
          evidenceSummary: 'Todo correcto.',
          observedEvidence: [],
          evaluationLimits: [],
        },
      },
      {
        onBeforeCall: ({ model, prompt }) => {
          expect(model).toBe('quality-model');
          expect(prompt.length).toBeLessThanOrEqual(150);
        },
      },
    );

    expect(trace.rawResponse).toBe(validQualityResponse);
    expect(trace.parsedContract?.security[0]).toEqual(
      expect.objectContaining({
        title: 'sprintf inseguro',
        severity: 'high',
      }),
    );
    expect(trace.error).toBeNull();
  });

  it('classifies missing quality models as model_not_found', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "model 'quality-model' not found",
    });

    const trace = await service.analyzeWithTrace({
      sourceCodePayload: 'int main(void) { return 0; }',
      executionLogs: 'ok',
      assignmentContext: {
        expectedType: 'C_CLI',
        rubricInstructions: 'Evalúa mantenibilidad y seguridad.',
        expectedOutput: null,
      },
      assessment: {
        schemaVersion: 'builder-llm/v2',
        stage: 'evaluation',
        thought: 'Eval.',
        structuralType: 'T2',
        capabilities: {
          C1: { status: 'yes', rationale: 'Manifest.' },
          C2: { status: 'yes', rationale: 'Entrada.' },
          C3: { status: 'no', rationale: 'CLI.' },
          C4: { status: 'yes', rationale: 'Tests.' },
          C5: { status: 'no', rationale: 'Sin healthcheck.' },
          C6: { status: 'no', rationale: 'Sin config.' },
        },
        evaluativeState: 'E1',
        confidence: 'high',
        rationale: 'Ok',
        recommendedGrade: 8,
        externalRequirements: [],
        runtime: {
          family: 'c',
          version: 'c11',
          supported: true,
          reason: null,
        },
        recipe: {
          install: [],
          run: ['./main'],
          test: [],
          systemPackages: [],
          cwd: '/app',
          environment: null,
          service: null,
        },
        evidenceSummary: 'Todo correcto.',
        observedEvidence: [],
        evaluationLimits: [],
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'model_not_found',
        httpStatus: 404,
        message: expect.stringContaining('quality-model'),
      }),
    );
  });
});
