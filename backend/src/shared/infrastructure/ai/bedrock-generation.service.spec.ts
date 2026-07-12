import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ConfiguredRetryStrategy } from '@smithy/util-retry';
import { BedrockGenerationService } from './bedrock-generation.service';

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(),
  ConverseCommand: jest.fn(),
}));

describe('BedrockGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configura el cliente con estrategia de reintentos exponenciales', () => {
    new BedrockGenerationService({
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as any);

    expect(BedrockRuntimeClient).toHaveBeenCalledTimes(1);
    const constructorArg = (BedrockRuntimeClient as jest.Mock).mock.calls[0][0];

    expect(constructorArg).toMatchObject({
      region: 'us-east-1',
      retryStrategy: expect.any(ConfiguredRetryStrategy),
    });
  });

  it('respeta valores personalizados de reintentos desde la configuracion', () => {
    new BedrockGenerationService({
      get: jest.fn((key: string) => {
        if (key === 'BUILDER_BEDROCK_MAX_ATTEMPTS') return 5;
        if (key === 'BUILDER_BEDROCK_RETRY_BASE_DELAY_MS') return 100;
        if (key === 'AWS_REGION') return 'eu-west-1';
        return undefined;
      }),
    } as any);

    const constructorArg = (BedrockRuntimeClient as jest.Mock).mock.calls[0][0];
    expect(constructorArg).toMatchObject({
      region: 'eu-west-1',
      retryStrategy: expect.any(ConfiguredRetryStrategy),
    });
  });
});
