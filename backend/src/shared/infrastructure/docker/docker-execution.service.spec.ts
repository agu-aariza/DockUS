import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from './docker-container.service';
import { DockerNetworkService } from './docker-network.service';
import { DockerExecutionService } from './docker-execution.service';

describe('DockerExecutionService', () => {
  let service: DockerExecutionService;
  let dockerNetworkService: jest.Mocked<DockerNetworkService>;
  let dockerContainerService: jest.Mocked<DockerContainerService>;

  beforeEach(() => {
    dockerNetworkService = {
      createNetwork: jest.fn().mockResolvedValue(undefined),
      removeNetwork: jest.fn().mockResolvedValue(true),
      inspectNetwork: jest.fn().mockResolvedValue(null),
      networkExists: jest.fn().mockResolvedValue(false),
      listNetworks: jest.fn().mockResolvedValue([]),
    };
    dockerContainerService = {
      runContainer: jest.fn().mockResolvedValue('container-456'),
      runDaemonContainer: jest.fn().mockResolvedValue('container-123'),
      runEphemeralContainer: jest.fn(),
      waitContainer: jest.fn(),
      getContainerLogs: jest.fn(),
      inspectContainer: jest.fn(),
      removeContainer: jest.fn(),
      listContainers: jest.fn().mockResolvedValue([]),
    };
    service = new DockerExecutionService(
      {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'BUILDER_DOCKER_RUNTIME') {
            return 'runsc';
          }
          return defaultValue;
        }),
      } as unknown as ConfigService,
      dockerNetworkService,
      dockerContainerService,
      {} as never,
    );
  });

  it('crea una red Docker etiquetada cuando no existe', async () => {
    await service.createNetwork('dockus-run-123', {
      internal: true,
      labels: {
        'dockus.managed': 'true',
        'dockus.scope': 'run',
      },
    });

    expect(dockerNetworkService.createNetwork).toHaveBeenCalledWith(
      'dockus-run-123',
      expect.objectContaining({
        internal: true,
        labels: {
          'dockus.managed': 'true',
          'dockus.scope': 'run',
        },
      }),
    );
  });

  it('crea y arranca un contenedor daemon con runtime, red y hardening base', async () => {
    const containerId = await service.runDaemonContainer({
      containerName: 'svc-run-123',
      imageTag: 'dockus:test',
      command: ['python', '-m', 'http.server', '8000'],
      networkName: 'dockus-run-123',
      networkAlias: 'svc-run-123',
      labels: {
        'dockus.managed': 'true',
        'dockus.role': 'service',
      },
      cpus: '0.7',
      memory: '768m',
    });

    expect(containerId).toBe('container-123');
    expect(dockerContainerService.runDaemonContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: 'svc-run-123',
        networkName: 'dockus-run-123',
        networkAlias: 'svc-run-123',
        runtime: 'runsc',
        cpus: '0.7',
        memory: '768m',
      }),
    );
  });

  it('crea un contenedor efimero sin salida de red cuando usa network none', async () => {
    await service.runContainer({
      containerName: 'batch-run-456',
      imageTag: 'dockus:test',
      command: ['python', '-c', 'print("ok")'],
      networkMode: 'none',
      labels: {
        'dockus.managed': 'true',
      },
    });

    expect(dockerContainerService.runContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: 'batch-run-456',
        networkMode: 'none',
        runtime: 'runsc',
      }),
    );
  });
});
