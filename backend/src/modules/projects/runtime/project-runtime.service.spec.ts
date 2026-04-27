import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  BuildRun,
  BuildRunStatus,
} from '../builder/domain/entities/build-run.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import {
  Project,
  ProjectClusterStatus,
  ProjectStatus,
} from '../entities/project.entity';
import { ProjectRuntimeClusterService } from './project-runtime-cluster.service';
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

  const clusterService = {
    deriveClusterName: jest.fn(
      (projectId: string) => `dockus-project-${projectId.slice(0, 12)}`,
    ),
    createCluster: jest.fn(),
    deleteCluster: jest.fn(),
    listNamespacesAndPods: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    activeRunsQueryBuilder.innerJoin.mockReturnThis();
    activeRunsQueryBuilder.where.mockReturnThis();
    activeRunsQueryBuilder.andWhere.mockReturnThis();
    activeRunsQueryBuilder.orderBy.mockReturnThis();
    activeRunsQueryBuilder.getMany.mockResolvedValue([]);
    projectsRepository.find.mockResolvedValue([]);
    projectsRepository.save.mockImplementation(
      async (project: Project) => project,
    );

    service = new ProjectRuntimeService(
      projectsRepository as unknown as Repository<Project>,
      buildRunsRepository as unknown as Repository<BuildRun>,
      runtimeQueue as never,
      clusterService as unknown as ProjectRuntimeClusterService,
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'BUILDER_K8S_NAMESPACE_PREFIX') {
            return 'dockus-run';
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
      runtimeClusterName: null,
      runtimeClusterStatus: ProjectClusterStatus.ABSENT,
      runtimeLastError: 'old error',
    } as Project;

    const result = await service.transitionProjectStatus(
      project,
      ProjectStatus.ACTIVE,
    );

    expect(clusterService.deriveClusterName).toHaveBeenCalledWith(project.id);
    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        status: ProjectStatus.ACTIVE,
        runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
        runtimeClusterName: 'dockus-project-550e8400-e29',
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
          namespace: 'dockus-run-1234',
          primaryPodName: null,
          helperPodNames: [],
        },
        createdAt: new Date('2026-04-24T10:00:00.000Z'),
      },
    ]);

    const project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Runtime Demo',
      status: ProjectStatus.ACTIVE,
      creatorId: 'teacher-1',
      runtimeClusterName: 'dockus-project-550e8400-e29',
      runtimeClusterStatus: ProjectClusterStatus.READY,
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
      runtimeClusterName: 'dockus-project-550e8400-e29',
      runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
      runtimeProvisionedAt: null,
      runtimeLastError: null,
    } as Project;
    projectsRepository.findOne.mockResolvedValue(project);

    await service.processJob({
      projectId: project.id,
      action: 'provision',
    });

    expect(clusterService.createCluster).toHaveBeenCalledWith(
      'dockus-project-550e8400-e29',
    );
    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        runtimeClusterStatus: ProjectClusterStatus.READY,
        runtimeLastError: null,
      }),
    );
  });
});
