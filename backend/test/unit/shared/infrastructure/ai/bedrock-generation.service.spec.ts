import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ConfiguredRetryStrategy } from '@smithy/util-retry';
import { BedrockGenerationService } from '@app/shared/infrastructure/ai/bedrock-generation.service';
import type {
  LlmGenerateRequest,
  LlmProviderCredentials,
} from '@app/shared/infrastructure/ai/llm.types';

const send = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send })),
  ConverseCommand: jest.fn(),
}));

describe('BedrockGenerationService', () => {
  const buildService = (env: Record<string, unknown> = {}) =>
    new BedrockGenerationService({
      get: jest.fn((key: string, fallback?: unknown) =>
        key in env ? env[key] : fallback,
      ),
    } as never);

  const buildRequest = (
    credentials: LlmProviderCredentials | null = null,
  ): LlmGenerateRequest => ({
    stage: 'evaluation',
    promptId: 'eval',
    prompt: 'hola',
    systemPrompt: null,
    credentials,
    profile: {
      profileVersion: 'test/v1',
      stage: 'evaluation',
      providerId: 'bedrock',
      modelId: 'modelo',
      maxTokens: 100,
      temperature: 0.2,
      topP: 0.9,
      stopSequences: [],
      timeoutMs: 5_000,
    },
  });

  const buildCredentials = (
    overrides: Partial<LlmProviderCredentials> = {},
  ): LlmProviderCredentials => ({
    providerId: 'bedrock',
    apiKey: null,
    accessKeyId: null,
    endpoint: null,
    region: null,
    modelVersion: null,
    ...overrides,
  });

  const clientArgs = (index = 0) =>
    (BedrockRuntimeClient as unknown as jest.Mock).mock.calls[index][0];

  beforeEach(() => {
    jest.clearAllMocks();
    send.mockResolvedValue({
      output: { message: { content: [{ text: 'respuesta' }] } },
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('configura el cliente con estrategia de reintentos exponenciales', async () => {
    await buildService().generate(buildRequest());

    expect(BedrockRuntimeClient).toHaveBeenCalledTimes(1);
    expect(clientArgs()).toMatchObject({
      region: 'us-east-1',
      retryStrategy: expect.any(ConfiguredRetryStrategy),
    });
  });

  it('respeta valores personalizados de reintentos desde la configuracion', async () => {
    await buildService({
      BUILDER_BEDROCK_MAX_ATTEMPTS: 5,
      BUILDER_BEDROCK_RETRY_BASE_DELAY_MS: 100,
      AWS_REGION: 'eu-west-1',
    }).generate(buildRequest());

    expect(clientArgs()).toMatchObject({
      region: 'eu-west-1',
      retryStrategy: expect.any(ConfiguredRetryStrategy),
    });
  });

  it('usa la región configurada en la pestaña "Modelos de IA" por encima de la del entorno', async () => {
    await buildService({ AWS_REGION: 'us-east-1' }).generate(
      buildRequest(buildCredentials({ region: 'eu-west-1' })),
    );

    expect(clientArgs()).toMatchObject({ region: 'eu-west-1' });
  });

  it('usa las credenciales AWS explícitas cuando se han configurado', async () => {
    await buildService().generate(
      buildRequest(
        buildCredentials({ accessKeyId: 'AKIA123', apiKey: 'secreta' }),
      ),
    );

    expect(clientArgs()).toMatchObject({
      credentials: { accessKeyId: 'AKIA123', secretAccessKey: 'secreta' },
    });
  });

  it('delega en la cadena de credenciales del SDK si falta el accessKeyId', async () => {
    await buildService().generate(
      buildRequest(buildCredentials({ apiKey: 'secreta-sin-id' })),
    );

    expect(clientArgs()).not.toHaveProperty('credentials');
  });

  it('reutiliza el cliente entre llamadas con la misma región y credenciales', async () => {
    const service = buildService();

    await service.generate(
      buildRequest(buildCredentials({ region: 'eu-west-1' })),
    );
    await service.generate(
      buildRequest(buildCredentials({ region: 'eu-west-1' })),
    );
    await service.generate(
      buildRequest(buildCredentials({ region: 'us-west-2' })),
    );

    expect(BedrockRuntimeClient).toHaveBeenCalledTimes(2);
  });
});
/**
 * Pruebas del adaptador de generación para Bedrock y de sus respuestas de error.
 */
