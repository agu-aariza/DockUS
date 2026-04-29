import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from '../../../shared/infrastructure/docker/docker-container.service';
import { DockerHostService } from '../../../shared/infrastructure/docker/docker-host.service';
import { DockerNetworkService } from '../../../shared/infrastructure/docker/docker-network.service';
import { ProjectRuntimeNetworkService } from './project-runtime-network.service';

describe('ProjectRuntimeNetworkService', () => {
  let dockerHostService: jest.Mocked<DockerHostService>;
  let dockerNetworkService: jest.Mocked<DockerNetworkService>;
  let dockerContainerService: jest.Mocked<DockerContainerService>;

  beforeEach(() => {
    dockerHostService = {
      assertDockerAvailable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DockerHostService>;
    dockerNetworkService = {
      createNetwork: jest.fn().mockResolvedValue(undefined),
      removeNetwork: jest.fn().mockResolvedValue(true),
      networkExists: jest.fn().mockResolvedValue(false),
      listNetworks: jest.fn().mockResolvedValue([]),
      inspectNetwork: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DockerNetworkService>;
    dockerContainerService = {
      inspectContainer: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DockerContainerService>;
  });

  function createService(nodeEnv = 'development', runtime = 'runc') {
    return new ProjectRuntimeNetworkService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'NODE_ENV') {
            return nodeEnv;
          }
          if (key === 'BUILDER_DOCKER_RUNTIME') {
            return runtime;
          }
          return fallback;
        }),
      } as unknown as ConfigService,
      dockerHostService,
      dockerNetworkService,
      dockerContainerService,
    );
  }

  it('crea la red workspace como red interna etiquetada', async () => {
    const service = createService();

    await service.ensureWorkspaceNetwork('dockus-workspace-123', 'project-123');

    expect(dockerNetworkService.createNetwork).toHaveBeenCalledWith(
      'dockus-workspace-123',
      expect.objectContaining({
        internal: true,
        labels: {
          'dockus.managed': 'true',
          'dockus.scope': 'workspace',
          'dockus.projectId': 'project-123',
        },
      }),
    );
  });

  it('propaga el rechazo del host cuando producción exige runsc registrado', async () => {
    const service = createService('production', 'runsc');
    dockerHostService.assertDockerAvailable.mockRejectedValue(
      new ServiceUnavailableException('runtime runsc no registrado'),
    );

    await expect(
      service.ensureWorkspaceNetwork('dockus-workspace-123', 'project-123'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
