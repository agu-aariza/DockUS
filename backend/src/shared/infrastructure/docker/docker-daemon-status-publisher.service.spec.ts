import { ConfigService } from '@nestjs/config';
import {
  DOCKER_DAEMON_STATUS_REDIS_KEY,
  DockerDaemonStatusPublisherService,
} from './docker-daemon-status-publisher.service';
import { DockerHostService } from './docker-host.service';
import { RedisClientService } from '../cache/redis-client.service';

describe('DockerDaemonStatusPublisherService', () => {
  let dockerHost: { assertDockerAvailable: jest.Mock };
  let redisClient: { set: jest.Mock };
  let configService: { get: jest.Mock };

  const build = (processRole: 'api' | 'worker') => {
    dockerHost = { assertDockerAvailable: jest.fn() };
    redisClient = { set: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    };

    return new DockerDaemonStatusPublisherService(
      dockerHost as unknown as DockerHostService,
      redisClient as unknown as RedisClientService,
      configService as unknown as ConfigService,
      processRole,
    );
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('no publica nada en el proceso de la API', () => {
    const service = build('api');

    service.onModuleInit();

    expect(dockerHost.assertDockerAvailable).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('publica status "up" en Redis con TTL cuando el daemon responde', async () => {
    const service = build('worker');
    dockerHost.assertDockerAvailable.mockResolvedValue({
      ServerVersion: '27.0.0',
    });

    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(redisClient.set).toHaveBeenCalledWith(
      DOCKER_DAEMON_STATUS_REDIS_KEY,
      expect.stringContaining('"status":"up"'),
      60,
    );
    expect(redisClient.set.mock.calls[0][1]).toContain('27.0.0');
    service.onModuleDestroy();
  });

  it('publica status "down" cuando assertDockerAvailable falla, sin lanzar', async () => {
    const service = build('worker');
    dockerHost.assertDockerAvailable.mockRejectedValue(
      new Error('Docker daemon no disponible: sin version de servidor.'),
    );

    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(redisClient.set).toHaveBeenCalledWith(
      DOCKER_DAEMON_STATUS_REDIS_KEY,
      expect.stringContaining('"status":"down"'),
      60,
    );
    service.onModuleDestroy();
  });

  it('detiene el intervalo en onModuleDestroy', () => {
    const service = build('worker');
    service.onModuleInit();

    const clearSpy = jest.spyOn(global, 'clearInterval');
    service.onModuleDestroy();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
