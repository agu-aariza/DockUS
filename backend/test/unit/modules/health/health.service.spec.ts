import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { RedisClientService } from '@app/shared/infrastructure/cache/redis-client.service';
import { DOCKER_DAEMON_STATUS_REDIS_KEY } from '@app/shared/infrastructure/docker/docker-daemon-status-publisher.service';
import { HealthService } from '@app/modules/health/health.service';
import type { MinioStorageService } from '@app/shared/infrastructure/storage/minio-storage.service';

const mockBedrockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock', () => ({
  BedrockClient: jest
    .fn()
    .mockImplementation(() => ({ send: mockBedrockSend })),
  ListFoundationModelsCommand: jest.fn().mockImplementation(() => ({})),
}));

describe('HealthService', () => {
  let dataSource: { query: jest.Mock };
  let redisClient: { ping: jest.Mock; get: jest.Mock };
  let configService: { get: jest.Mock };
  let logger: { error: jest.Mock };
  let minioStorageService: { checkHealth: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    mockBedrockSend.mockReset();
    mockBedrockSend.mockResolvedValue({ modelSummaries: [] });

    dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    redisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
      // la API ya no llama al daemon Docker directamente,
      // lee lo que el worker publicó en Redis.
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          status: 'up',
          info: 'Docker version 27.0.0 (runtime=runc)',
          checkedAt: new Date().toISOString(),
        }),
      ),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        return fallback;
      }),
    };
    logger = { error: jest.fn() };
    minioStorageService = {
      checkHealth: jest.fn().mockResolvedValue({
        status: 'up',
        latencyMs: 3,
        info: 'Bucket "educodeai-storage" accesible en MinIO.',
      }),
    };

    service = new HealthService(
      dataSource as unknown as DataSource,
      redisClient as unknown as RedisClientService,
      configService as unknown as ConfigService,
      logger as unknown as Logger,
      minioStorageService as unknown as MinioStorageService,
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

  it('reads el estado de Docker publicado por el worker en Redis', async () => {
    const report = await service.getReadiness();

    expect(redisClient.get).toHaveBeenCalledWith(
      DOCKER_DAEMON_STATUS_REDIS_KEY,
    );
    expect(report.checks.docker).toEqual(
      expect.objectContaining({
        status: 'up',
        info: expect.stringContaining('runtime=runc'),
      }),
    );
  });

  it('reporta Docker caido si el worker publico status down', async () => {
    redisClient.get.mockResolvedValue(
      JSON.stringify({
        status: 'down',
        info: 'Sandbox runtime invalido para produccion: runc.',
        checkedAt: new Date().toISOString(),
      }),
    );

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.docker).toEqual(
      expect.objectContaining({ status: 'down' }),
    );
  });

  it('reporta Docker caido si el worker no ha publicado nada (clave ausente o expirada)', async () => {
    redisClient.get.mockResolvedValue(null);

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.docker).toEqual(
      expect.objectContaining({ status: 'down' }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Docker'),
      undefined,
      'HealthService',
    );
  });

  it('reporta almacenamiento MinIO caido si checkHealth falla (A003)', async () => {
    minioStorageService.checkHealth.mockResolvedValue({
      status: 'down',
      latencyMs: 12,
      info: 'Bucket not found',
    });

    const report = await service.getReadiness();

    expect(report.status).toBe('error');
    expect(report.checks.storage).toEqual(
      expect.objectContaining({
        status: 'down',
        info: 'Bucket not found',
      }),
    );
  });

  it('reporta readiness ok cuando MinIO responde correctamente (A003)', async () => {
    const report = await service.getReadiness();

    expect(report.status).toBe('ok');
    expect(report.checks.storage).toEqual(
      expect.objectContaining({
        status: 'up',
      }),
    );
  });

  it('omite llamada a Bedrock si el proveedor activo configurado no es bedrock (A004)', async () => {
    configService.get = jest.fn((key: string, fallback?: unknown) => {
      if (key === 'LLM_PROVIDER') return 'gemini';
      return fallback;
    });

    const report = await service.getReadiness();

    expect(report.status).toBe('ok');
    expect(report.checks.bedrock).toEqual(
      expect.objectContaining({
        status: 'up',
        info: expect.stringContaining('gemini'),
      }),
    );
    expect(mockBedrockSend).not.toHaveBeenCalled();
  });

  it('omite llamada a Bedrock si HEALTHCHECK_BEDROCK_ENABLED es false (A004)', async () => {
    configService.get = jest.fn((key: string, fallback?: unknown) => {
      if (key === 'HEALTHCHECK_BEDROCK_ENABLED') return false;
      return fallback;
    });

    const report = await service.getReadiness();

    expect(report.status).toBe('ok');
    expect(report.checks.bedrock.status).toBe('up');
    expect(mockBedrockSend).not.toHaveBeenCalled();
  });
});
