import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  BuildRun,
  BuildRunStatus,
} from '../builder/domain/entities/build-run.entity';
import {
  Project,
  ProjectRuntimeEnvironmentStatus,
  ProjectStatus,
} from '../entities/project.entity';
import { ProjectRuntimeNetworkService } from './project-runtime-network.service';
import { ProjectRuntimeService } from './project-runtime.service';

describe('ProjectRuntimeService', () => {
  let service: ProjectRuntimeService;

  const activeRunsQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const projectsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const buildRunsRepository = {
    createQueryBuilder: jest.fn(() => activeRunsQueryBuilder),
  };

  const runtimeQueue = {
    add: jest.fn(),
  };

  const networkService = {
    deriveWorkspaceNetworkName: jest.fn(
      (projectId: string) => `dockus-workspace-${projectId.slice(0, 12)}`,
    ),
    ensureWorkspaceNetwork: jest.fn(),
    removeWorkspaceNetwork: jest.fn(),
    listManagedNetworksAndContainers: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    activeRunsQueryBuilder.innerJoin.mockReturnThis();
    activeRunsQueryBuilder.where.mockReturnThis();
    activeRunsQueryBuilder.andWhere.mockReturnThis();
    activeRunsQueryBuilder.orderBy.mockReturnThis();
    activeRunsQueryBuilder.getMany.mockResolvedValue([]);
    projectsRepository.find.mockResolvedValue([]);
    projectsRepository.save.mockImplementation((project: Project) =>
      Promise.resolve(project),
    );

    service = new ProjectRuntimeService(
      projectsRepository as unknown as Repository<Project>,
      buildRunsRepository as unknown as Repository<BuildRun>,
      runtimeQueue as never,
      networkService as unknown as ProjectRuntimeNetworkService,
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'BUILDER_EXECUTION_NETWORK_PREFIX') {
            return 'dockus-run';
          }
          if (key === 'BUILDER_WORKSPACE_NETWORK_PREFIX') {
            return 'dockus-workspace';
          }
          return fallback;
        }),
      } as unknown as ConfigService,
    );
  });

  it('activa un proyecto dejando el runtime en provisioning y encolando provisión', async () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Runtime Demo',
      status: ProjectStatus.DRAFT,
      creatorId: 'teacher-1',
      runtimeNetworkName: null,
      runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.ABSENT,
      runtimeLastError: 'old error',
    } as Project;

    const result = await service.transitionProjectStatus(
      project,
      ProjectStatus.ACTIVE,
    );

    expect(networkService.deriveWorkspaceNetworkName).toHaveBeenCalledWith(
      project.id,
    );
    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        status: ProjectStatus.ACTIVE,
        runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
        runtimeNetworkName: 'dockus-workspace-550e8400-e29',
        runtimeLastError: null,
      }),
    );
    expect(runtimeQueue.add).toHaveBeenCalledWith(
      'project-runtime-sync',
      {
        projectId: project.id,
        action: 'provision',
      },
      expect.objectContaining({
        jobId: `project-runtime-provision-${project.id}`,
      }),
    );
    expect(result.status).toBe(ProjectStatus.ACTIVE);
  });

  it('rechaza archivar si el proyecto mantiene runs activos', async () => {
    activeRunsQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'run-1',
        deliveryId: 'delivery-1',
        status: BuildRunStatus.BUILDING,
        activeStage: null,
        runtimeTarget: {
          executionNetworkName: 'dockus-run-1234',
          primaryContainerId: null,
          helperContainerIds: [],
        },
        createdAt: new Date('2026-04-24T10:00:00.000Z'),
      },
    ]);

    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Runtime Demo',
      status: ProjectStatus.ACTIVE,
      creatorId: 'teacher-1',
      runtimeNetworkName: 'dockus-workspace-550e8400-e29',
      runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.READY,
    } as Project;

    await expect(
      service.transitionProjectStatus(project, ProjectStatus.ARCHIVED),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marca el runtime READY cuando la provisión termina correctamente', async () => {
    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Runtime Demo',
      status: ProjectStatus.ACTIVE,
      creatorId: 'teacher-1',
      runtimeNetworkName: 'dockus-workspace-550e8400-e29',
      runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
      runtimeProvisionedAt: null,
      runtimeLastError: null,
    } as Project;
    projectsRepository.findOne.mockResolvedValue(project);

    await service.processJob({
      projectId: project.id,
      action: 'provision',
    });

    expect(networkService.ensureWorkspaceNetwork).toHaveBeenCalledWith(
      'dockus-workspace-550e8400-e29',
      project.id,
    );
    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.READY,
        runtimeLastError: null,
      }),
    );
  });
});
