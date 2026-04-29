import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerHostService } from '../../../../../shared/infrastructure/docker/docker-host.service';
import { DockerImageService } from '../../../../../shared/infrastructure/docker/docker-image.service';
import { ExecutionEnvironmentService } from './execution-environment.service';

describe('ExecutionEnvironmentService', () => {
  let dockerHostService: jest.Mocked<DockerHostService>;
  let dockerImageService: jest.Mocked<DockerImageService>;

  beforeEach(() => {
    dockerHostService = {
      assertDockerAvailable: jest.fn().mockResolvedValue(undefined),
      tryVersion: jest.fn().mockResolvedValue('Docker version 26.1.0'),
    } as unknown as jest.Mocked<DockerHostService>;
    dockerImageService = {
      tryImageDigest: jest.fn().mockResolvedValue(null),
      buildImage: jest.fn(),
      removeImage: jest.fn(),
    } as unknown as jest.Mocked<DockerImageService>;
  });

  function createService(nodeEnv = 'development', runtime = 'runsc') {
    return new ExecutionEnvironmentService(
      {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'NODE_ENV') {
            return nodeEnv;
          }
          if (key === 'BUILDER_DOCKER_RUNTIME') {
            return runtime;
          }
          return defaultValue;
        }),
      } as unknown as ConfigService,
      dockerHostService,
      dockerImageService,
    );
  }

  it('rechaza el runtime en produccion si la verificación del host falla', async () => {
    const service = createService('production', 'runsc');
    dockerHostService.assertDockerAvailable.mockRejectedValue(
      new ServiceUnavailableException('runtime runsc no registrado'),
    );

    await expect(service.assertDockerAvailable()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('incluye la politica de red del sandbox en el execution context', async () => {
    const service = createService();

    const context = await service.collectExecutionContext(
      'python:3.11.9-slim-bookworm',
      'dockus-workspace-123',
    );

    expect(context.runtimeBackend).toBe('docker-cli');
    expect(context.sandboxRuntime).toBe('runsc');
    expect(context.sandboxNetworkPolicy).toBe('isolated');
  });
});
