import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '@app/shared/infrastructure/ai/prompt-registry.service';
import { ILlmGenerationService } from '@app/shared/infrastructure/ai/llm-generation.token';
import { BedrockRequestError } from '@app/shared/infrastructure/ai/bedrock-request.util';
import { BuilderLlmDispatcherService } from '@app/modules/projects/builder/application/services/ai/builder-llm-dispatcher.service';
import { BuilderCodeQualityService } from '@app/modules/projects/builder/application/services/ai/builder-code-quality.service';
import { BuilderLlmConfigService } from '@app/modules/projects/builder/application/services/config/builder-llm-config.service';
import { resolveBuilderModelProfile } from '@app/modules/projects/builder/domain/ai/builder-llm-model-profile';

const validQualityResponse = JSON.stringify({
  thought: 'Calidad consistente.',
  security: [
    {
      title: 'sprintf inseguro',
      detail:
        'Observacion: se usa sprintf. Impacto: riesgo de desbordamiento. Recomendacion: usa snprintf.',
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
  const promptRegistry = {
    getPrompt: jest.fn(() => 'TECHNICAL_FEEDBACK_PROMPT'),
  } as unknown as PromptRegistryService;

  const llmService: jest.Mocked<ILlmGenerationService> = {
    generate: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      switch (key) {
        case 'BUILDER_BEDROCK_QUALITY_MODEL_ID':
          return 'bedrock-quality-model';
        case 'BUILDER_LLM_QUALITY_MAX_INPUT_CHARS':
          return 240;
        default:
          return fallback;
      }
    }),
  } as unknown as ConfigService;

  const llmConfigService = {
    resolveStageProfile: jest.fn(async () => ({
      profile: resolveBuilderModelProfile('quality', configService),
      credentials: null,
    })),
    resolveStageCandidates: jest.fn(async () => [
      {
        profile: resolveBuilderModelProfile('quality', configService),
        credentials: null,
        isPrimary: true,
      },
    ]),
  } as unknown as BuilderLlmConfigService;

  let service: BuilderCodeQualityService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new BuilderCodeQualityService(
      configService,
      promptRegistry,
      /**
       * Despachador REAL sobre el doble de generación: las aserciones existentes
       * sobre `llmService.generate` siguen siendo válidas y, de paso, cada prueba
       * ejercita la ruta de conmutación en lugar de sortearla con otro doble.
       */
      new BuilderLlmDispatcherService(llmService as never, llmConfigService, {
        isOpen: () => Promise.resolve(false),
        recordFailure: jest.fn(),
        recordSuccess: jest.fn(),
      } as never),
      llmConfigService,
    );
  });

  it('captures prompt sections, raw response, and parsed contract during analysis', async () => {
    llmService.generate.mockResolvedValue({
      text: validQualityResponse,
      usage: { inputTokens: 120, outputTokens: 40 },
    });

    const trace = await service.analyzeWithTrace(
      {
        sourceCodePayload: 'A'.repeat(2000),
        execution: {
          ran: true,
          stdout: 'B'.repeat(2000),
          stderr: '',
          exitCode: 0,
        },
        assignmentContext: {
          expectedType: 'C_CLI',
          rubricInstructions: 'Evalua mantenibilidad y seguridad.',
          rubricCriteria: null,
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
          gradeBreakdown: [],
          studentSummary: 'Test summary.',
          teacherSummary: 'Test teacher summary.',
        },
      },
      {
        onBeforeCall: ({ modelProfile, sections, prompt }) => {
          expect(modelProfile).toEqual(
            expect.objectContaining({
              stage: 'quality',
              modelId: 'bedrock-quality-model',
            }),
          );
          expect(prompt.length).toBeLessThanOrEqual(240);
          expect(
            sections.some(
              (section) => section.label === 'CURRENT ACADEMIC ASSESSMENT',
            ),
          ).toBe(true);
          expect(
            sections.some((section) => section.label === 'SOURCE EXCERPTS'),
          ).toBe(true);
        },
      },
    );

    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'quality',
        promptId: 'technical-feedback',
        systemPrompt: 'TECHNICAL_FEEDBACK_PROMPT',
        profile: expect.objectContaining({
          modelId: 'bedrock-quality-model',
          stage: 'quality',
        }),
      }),
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

  it('serializes quality model errors with prompt id and profile metadata', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    llmService.generate.mockRejectedValue(
      new BedrockRequestError({
        code: 'model_not_found',
        message: "El modelo 'quality-model' no esta disponible.",
        httpStatus: 404,
      }),
    );

    const trace = await service.analyzeWithTrace({
      sourceCodePayload: 'int main(void) { return 0; }',
      execution: { ran: true, stdout: 'ok', stderr: '', exitCode: 0 },
      assignmentContext: {
        expectedType: 'C_CLI',
        rubricInstructions: 'Evalua mantenibilidad y seguridad.',
        rubricCriteria: null,
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
        gradeBreakdown: [],
        studentSummary: 'Test summary.',
        teacherSummary: 'Test teacher summary.',
      },
    });

    expect(trace.parsedContract).toBeNull();
    expect(trace.error).toEqual(
      expect.objectContaining({
        code: 'model_not_found',
        httpStatus: 404,
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"promptId":"technical-feedback"'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"modelId":"bedrock-quality-model"'),
    );
  });
});
