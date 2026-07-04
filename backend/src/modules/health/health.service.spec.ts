import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { RedisClientService } from '../../shared/infrastructure/cache/redis-client.service';
import { DockerHostService } from '../../shared/infrastructure/docker/docker-host.service';
import { HealthService } from './health.service';

const mockBedrockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock', () => ({
  BedrockClient: jest
    .fn()
    .mockImplementation(() => ({ send: mockBedrockSend })),
  ListFoundationModelsCommand: jest.fn().mockImplementation(() => ({})),
}));

describe('HealthService', () => {
  let dataSource: { query: jest.Mock };
  let redisClient: { ping: jest.Mock };
  let dockerHost: { inspectDockerHost: jest.Mock };
  let configService: { get: jest.Mock };
  let logger: { error: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    mockBedrockSend.mockReset();
    mockBedrockSend.mockResolvedValue({ modelSummaries: [] });

    dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    redisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    dockerHost = {
      inspectDockerHost: jest
        .fn()
        .mockResolvedValue({ ServerVersion: '27.0.0' }),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        return fallback;
      }),
    };
    logger = { error: jest.fn() };

    service = new HealthService(
      dataSource as unknown as DataSource,
      redisClient as unknown as RedisClientService,
      dockerHost as unknown as DockerHostService,
      configService as unknown as ConfigService,
      logger as unknown as Logger,
    );
  });

  it('reports readiness ok when Bedrock is accessible', async () => {
    const report = await service.getReadiness();

    expect(report.status).toBe('ok');
    expect(report.checks.bedrock).toEqual(
      expect.objectContaining({
        status: 'up',
        info: expect.stringContaining('us-east-1'),
      }),
    );
  });

  it('reports readiness error when Bedrock call throws', async () => {
    mockBedrockSend.mockRejectedValue(
      new Error('UnrecognizedClientException: credentials not configured'),
    );

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.bedrock).toEqual(
      expect.objectContaining({ status: 'down' }),
    );
  });

  it('reports database down correctly', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.database).toEqual(
      expect.objectContaining({ status: 'down' }),
    );
  });
});
