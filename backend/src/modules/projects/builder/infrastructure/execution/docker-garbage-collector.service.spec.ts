import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DockerContainerService } from '../../../../../shared/infrastructure/docker/docker-container.service';
import { DockerImageService } from '../../../../../shared/infrastructure/docker/docker-image.service';
import { DockerNetworkService } from '../../../../../shared/infrastructure/docker/docker-network.service';
import { BuildRun } from '../../domain/entities/build-run.entity';
import { DockerGarbageCollectorService } from './docker-garbage-collector.service';

describe('DockerGarbageCollectorService', () => {
  let service: DockerGarbageCollectorService;
  let buildRunsRepository: jest.Mocked<Repository<BuildRun>>;
  let dockerContainerService: jest.Mocked<DockerContainerService>;
  let dockerNetworkService: jest.Mocked<DockerNetworkService>;
  let dockerImageService: jest.Mocked<DockerImageService>;

  beforeEach(() => {
    buildRunsRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<BuildRun>>;
    dockerContainerService = {
      listContainers: jest.fn().mockResolvedValue([
        { ID: 'container-a', State: 'exited' },
        { ID: 'container-b', State: 'running' },
      ]),
      removeContainer: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DockerContainerService>;
    dockerNetworkService = {
      listNetworks: jest
        .fn()
        .mockResolvedValue([
          { Name: 'dockus-run-123' },
          { Name: 'dockus-workspace-123' },
        ]),
      inspectNetwork: jest.fn().mockResolvedValue({ Containers: {} }),
      removeNetwork: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DockerNetworkService>;
    dockerImageService = {
      removeImage: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DockerImageService>;

    service = new DockerGarbageCollectorService(
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'BUILDER_CLEANUP_IMAGES') {
            return true;
          }
          return fallback;
        }),
      } as unknown as ConfigService,
      buildRunsRepository,
      dockerContainerService,
      dockerNetworkService,
      dockerImageService,
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('elimina contenedores gestionados detenidos y redes de run vacias', async () => {
    await service.pruneManagedResources();

    expect(dockerContainerService.listContainers).toHaveBeenCalled();
    expect(dockerContainerService.removeContainer).toHaveBeenCalledWith(
      'container-a',
      expect.any(Object),
    );
    expect(dockerNetworkService.removeNetwork).toHaveBeenCalledWith(
      'dockus-run-123',
      expect.any(Object),
    );
  });

  it('elimina imagenes expiradas asociadas a runs cerrados', async () => {
    buildRunsRepository.find.mockResolvedValue([
      {
        id: 'run-1',
        imageTag: 'dockus/delivery-1:run-1',
        imageExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ] as BuildRun[]);

    await service.pruneManagedResources();

    expect(dockerImageService.removeImage).toHaveBeenCalledWith(
      'dockus/delivery-1:run-1',
      expect.any(Object),
    );
    expect(buildRunsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-1',
        imageTag: null,
        imageExpiresAt: null,
      }),
    );
  });
});
