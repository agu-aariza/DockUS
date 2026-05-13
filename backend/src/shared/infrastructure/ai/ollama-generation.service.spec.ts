import { ConfigService } from '@nestjs/config';
import { OllamaGenerationService } from './ollama-generation.service';

describe('OllamaGenerationService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('serializes the shared runtime profile into the Ollama generate payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"ok":true}' }),
    });

    const service = new OllamaGenerationService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_OLLAMA_BASE_URL':
              return 'http://ollama.test';
            case 'BUILDER_OLLAMA_TIMEOUT_MS':
              return 2000;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
    );

    await service.generate({
      stage: 'plan',
      promptId: 'plan',
      prompt: 'USER_PROMPT',
      systemPrompt: 'SYSTEM_PROMPT',
      profile: {
        profileVersion: 'builder-llm-profile/v1',
        stage: 'plan',
        model: 'plan-model',
        baseModel: 'qwen2.5-coder:7b',
        numCtx: 24576,
        numPredict: -1,
        temperature: 0.1,
        topP: 0.9,
        repeatPenalty: 1.1,
        stopTokens: ['<|endoftext|>'],
        keepAliveSeconds: 300,
        timeoutMs: 120_000,
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      prompt: string;
      system: string;
      format: string;
      keep_alive: number;
      options: Record<string, unknown>;
    };

    expect(body.model).toBe('plan-model');
    expect(body.prompt).toBe('USER_PROMPT');
    expect(body.system).toBe('SYSTEM_PROMPT');
    expect(body.format).toBe('json');
    expect(body.keep_alive).toBe(300);
    expect(body.options).toEqual(
      expect.objectContaining({
        num_ctx: 24576,
        num_predict: -1,
        temperature: 0.1,
        top_p: 0.9,
        repeat_penalty: 1.1,
        stop: ['<|endoftext|>'],
      }),
    );
  });

  it('classifies missing models as model_not_found', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "model 'plan-model' not found",
    });

    const service = new OllamaGenerationService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          switch (key) {
            case 'BUILDER_OLLAMA_BASE_URL':
              return 'http://ollama.test';
            case 'BUILDER_OLLAMA_TIMEOUT_MS':
              return 2000;
            default:
              return fallback;
          }
        }),
      } as unknown as ConfigService,
    );

    await expect(
      service.generate({
        stage: 'plan',
        promptId: 'plan',
        prompt: 'USER_PROMPT',
        systemPrompt: 'SYSTEM_PROMPT',
        profile: {
          profileVersion: 'builder-llm-profile/v1',
          stage: 'plan',
          model: 'plan-model',
          baseModel: 'qwen2.5-coder:7b',
          numCtx: 24576,
          numPredict: -1,
          temperature: 0.1,
          topP: 0.9,
          repeatPenalty: 1.1,
          stopTokens: ['<|endoftext|>'],
          keepAliveSeconds: 300,
          timeoutMs: 120_000,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'model_not_found',
        httpStatus: 404,
      }),
    );
  });
});
