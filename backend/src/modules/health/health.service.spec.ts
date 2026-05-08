import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { RedisClientService } from '../../shared/infrastructure/cache/redis-client.service';
import { DockerHostService } from '../../shared/infrastructure/docker/docker-host.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const fetchMock = jest.fn();

  let dataSource: { query: jest.Mock };
  let redisClient: { ping: jest.Mock };
  let dockerHost: { inspectDockerHost: jest.Mock };
  let configService: { get: jest.Mock };
  let logger: { error: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    redisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    dockerHost = {
      inspectDockerHost: jest.fn().mockResolvedValue({ ServerVersion: '27.0.0' }),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        switch (key) {
          case 'BUILDER_OLLAMA_BASE_URL':
            return 'http://ollama:11434';
          case 'BUILDER_OLLAMA_PLAN_MODEL':
            return 'dockus-builder-plan';
          case 'BUILDER_OLLAMA_EVAL_MODEL':
            return 'dockus-builder-eval';
          case 'BUILDER_OLLAMA_QUALITY_MODEL':
            return 'dockus-builder-quality';
          case 'BUILDER_OLLAMA_TIMEOUT_MS':
            return 5000;
          default:
            return fallback;
        }
      }),
    };
    logger = {
      error: jest.fn(),
    };

    service = new HealthService(
      dataSource as unknown as DataSource,
      redisClient as unknown as RedisClientService,
      dockerHost as unknown as DockerHostService,
      configService as unknown as ConfigService,
      logger as unknown as Logger,
    );
  });

  it('reports readiness ok when Ollama responds and all required models are available', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'dockus-builder-plan:latest' },
          { name: 'dockus-builder-eval' },
          { name: 'dockus-builder-quality' },
        ],
      }),
    });

    const report = await service.getReadiness();

    expect(report.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama:11434/api/tags',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(report.checks.ollama).toEqual(
      expect.objectContaining({
        status: 'up',
        info: expect.stringContaining('3/3'),
      }),
    );
  });

  it('reports readiness error when Ollama is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.ollama).toEqual(
      expect.objectContaining({
        status: 'down',
        info: expect.stringContaining('http://ollama:11434'),
      }),
    );
  });

  it('reports readiness error when a required derived model is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'dockus-builder-plan' },
          { name: 'dockus-builder-eval' },
        ],
      }),
    });

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.ollama).toEqual(
      expect.objectContaining({
        status: 'down',
        info: expect.stringContaining('dockus-builder-quality'),
      }),
    );
  });
});
