import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JobsOptions, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/entities/user.entity';
import { BuildRunStatus } from '../builder/domain/entities/build-run.entity';
import { BuildRun } from '../builder/domain/entities/build-run.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import {
  Project,
  ProjectRuntimeEnvironmentStatus,
  ProjectStatus,
} from '../entities/project.entity';
import {
  DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX,
  PROJECT_RUNTIME_JOB_NAME,
  PROJECT_RUNTIME_QUEUE_NAME,
} from './project-runtime.constants';
import { ProjectRuntimeNetworkService } from './project-runtime-network.service';
import {
  ProjectRuntimeActiveRunSummary,
  ProjectRuntimeJobData,
  ProjectRuntimeNetworkSummary,
  ProjectRuntimeStatusResponse,
} from './project-runtime.types';

const ACTIVE_RUN_STATUSES: BuildRunStatus[] = [
  BuildRunStatus.QUEUED,
  BuildRunStatus.ANALYZING,
  BuildRunStatus.BUILDING,
  BuildRunStatus.DEPLOYING,
  BuildRunStatus.VALIDATING,
  BuildRunStatus.CLEANING,
];

@Injectable()
export class ProjectRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(ProjectRuntimeService.name);
  private readonly workspaceNetworkPrefix: string;
  private readonly executionNetworkPrefix: string;

  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectQueue(PROJECT_RUNTIME_QUEUE_NAME)
    private readonly runtimeQueue: Queue,
    private readonly projectRuntimeNetworkService: ProjectRuntimeNetworkService,
    private readonly configService: ConfigService,
  ) {
    this.workspaceNetworkPrefix =
      this.configService.get<string>(
        'BUILDER_WORKSPACE_NETWORK_PREFIX',
        DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX,
      ) ?? DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX;
    this.executionNetworkPrefix =
      this.configService.get<string>(
        'BUILDER_EXECUTION_NETWORK_PREFIX',
        'dockus-run',
      ) ?? 'dockus-run';
  }

  async onModuleInit(): Promise<void> {
    await this.reconcileActiveProjectsOnStartup();
  }

  async syncCreatedProject(project: Project): Promise<Project> {
    if (project.status !== ProjectStatus.ACTIVE) {
      return project;
    }

    const managedProject = await this.ensureRuntimeMetadata(project, {
      runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
      runtimeLastError: null,
    });
    await this.enqueueJob(managedProject.id, 'provision');
    return managedProject;
  }

  async transitionProjectStatus(
    project: Project,
    targetStatus: ProjectStatus,
  ): Promise<Project> {
    if (targetStatus === ProjectStatus.ACTIVE) {
      if (
        project.status === ProjectStatus.ACTIVE &&
        project.runtimeEnvironmentStatus ===
          ProjectRuntimeEnvironmentStatus.READY &&
        project.runtimeNetworkName
      ) {
        return this.projectsRepository.save(project);
      }
      const saved = await this.ensureRuntimeMetadata(project, {
        status: ProjectStatus.ACTIVE,
        runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
        runtimeLastError: null,
      });
      await this.enqueueJob(saved.id, 'provision');
      return saved;
    }

    await this.assertNoActiveRuns(project.id);
    const desiredStatus =
      project.runtimeNetworkName &&
      project.runtimeEnvironmentStatus !==
        ProjectRuntimeEnvironmentStatus.ABSENT
        ? ProjectRuntimeEnvironmentStatus.DELETING
        : ProjectRuntimeEnvironmentStatus.ABSENT;

    project.status = targetStatus;
    project.runtimeEnvironmentStatus = desiredStatus;
    project.runtimeLastError = null;
    if (desiredStatus === ProjectRuntimeEnvironmentStatus.ABSENT) {
      project.runtimeProvisionedAt = null;
    }
    const saved = await this.projectsRepository.save(project);
    if (desiredStatus === ProjectRuntimeEnvironmentStatus.DELETING) {
      await this.enqueueJob(saved.id, 'delete');
    }
    return saved;
  }

  async getRuntime(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectRuntimeStatusResponse> {
    const project = await this.findManagedProjectOrThrow(projectId, actor);
    const activeRuns = await this.listActiveRuns(project.id);
    let networks: ProjectRuntimeNetworkSummary[] = [];
    if (
      project.runtimeNetworkName &&
      project.runtimeEnvironmentStatus === ProjectRuntimeEnvironmentStatus.READY
    ) {
      try {
        networks =
          await this.projectRuntimeNetworkService.listManagedNetworksAndContainers(
            project.id,
            project.runtimeNetworkName,
            this.executionNetworkPrefix,
          );
      } catch {
        networks = [];
      }
    }

    return {
      projectId: project.id,
      workspaceNetworkName: project.runtimeNetworkName,
      status: project.runtimeEnvironmentStatus,
      provisionedAt: project.runtimeProvisionedAt?.toISOString() ?? null,
      lastError: project.runtimeLastError,
      activeRuns,
      networks,
    };
  }

  async requestReconcile(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.findManagedProjectOrThrow(projectId, actor);
    if (project.status !== ProjectStatus.ACTIVE) {
      throw new ConflictException(
        'Solo los proyectos ACTIVE pueden reconciliar su runtime.',
      );
    }
    if (
      project.runtimeEnvironmentStatus !==
        ProjectRuntimeEnvironmentStatus.ERROR &&
      project.runtimeEnvironmentStatus !==
        ProjectRuntimeEnvironmentStatus.ABSENT
    ) {
      throw new ConflictException(
        `El runtime del proyecto está en ${project.runtimeEnvironmentStatus} y no admite reconcile manual.`,
      );
    }

    const saved = await this.ensureRuntimeMetadata(project, {
      runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
      runtimeLastError: null,
    });
    await this.enqueueJob(saved.id, 'reconcile', true);
    return saved;
  }

  async processJob(data: ProjectRuntimeJobData): Promise<void> {
    const project = await this.projectsRepository.findOne({
      where: { id: data.projectId },
    });
    if (!project) {
      return;
    }

    switch (data.action) {
      case 'delete':
        await this.handleDelete(project);
        return;
      case 'provision':
      case 'reconcile':
        this.logger.log(
          `Procesando ${data.action} para proyecto ${project.id} (${project.title})`,
        );
        await this.handleProvision(project);
        return;
      default:
        return;
    }
  }

  createRuntimeTarget(project: Project, runId: string) {
    const workspaceNetworkName = this.assertProjectRuntimeReady(project);
    return {
      projectId: project.id,
      workspaceNetworkName,
      executionNetworkName: `${this.executionNetworkPrefix}-${runId
        .slice(0, 8)
        .toLowerCase()}`,
      primaryContainerId: null,
      helperContainerIds: [] as string[],
    };
  }

  assertProjectRuntimeReady(project: Project): string {
    if (project.status !== ProjectStatus.ACTIVE) {
      throw new ConflictException('La ejecución requiere un proyecto ACTIVE.');
    }
    if (
      project.runtimeEnvironmentStatus !== ProjectRuntimeEnvironmentStatus.READY ||
      !project.runtimeNetworkName
    ) {
      throw new ConflictException(
        `El runtime del proyecto no está listo (${project.runtimeEnvironmentStatus}).`,
      );
    }
    return project.runtimeNetworkName;
  }

  private async reconcileActiveProjectsOnStartup(): Promise<void> {
    const projects = await this.projectsRepository.find({
      where: {
        status: ProjectStatus.ACTIVE,
      },
    });

    for (const project of projects) {
      if (
        project.runtimeEnvironmentStatus === ProjectRuntimeEnvironmentStatus.READY
      ) {
        continue;
      }
      const saved = await this.ensureRuntimeMetadata(project, {
        runtimeEnvironmentStatus: ProjectRuntimeEnvironmentStatus.PROVISIONING,
        runtimeLastError: null,
      });
      await this.enqueueJob(saved.id, 'reconcile', true);
    }
  }

  private async handleProvision(project: Project): Promise<void> {
    try {
      if (project.status !== ProjectStatus.ACTIVE) {
        this.logger.warn(
          `Proyecto ${project.id} no está ACTIVE, abortando provisión.`,
        );
        return;
      }
      const runtimeNetworkName =
        project.runtimeNetworkName ??
        this.projectRuntimeNetworkService.deriveWorkspaceNetworkName(project.id);

      this.logger.log(
        `Iniciando creación/verificación de red workspace: ${runtimeNetworkName}`,
      );

      if (project.runtimeNetworkName !== runtimeNetworkName) {
        project.runtimeNetworkName = runtimeNetworkName;
        project.runtimeEnvironmentStatus =
          ProjectRuntimeEnvironmentStatus.PROVISIONING;
        project.runtimeLastError = null;
        await this.projectsRepository.save(project);
      }

      await this.projectRuntimeNetworkService.ensureWorkspaceNetwork(
        runtimeNetworkName,
        project.id,
      );

      this.logger.log(`Red workspace ${runtimeNetworkName} está READY.`);

      project.runtimeEnvironmentStatus = ProjectRuntimeEnvironmentStatus.READY;
      project.runtimeProvisionedAt = new Date();
      project.runtimeLastError = null;
      await this.projectsRepository.save(project);
    } catch (error) {
      this.logger.error(
        `Error en provisión de red workspace para proyecto ${project.id}: ${this.toErrorMessage(error)}`,
      );
      project.runtimeEnvironmentStatus = ProjectRuntimeEnvironmentStatus.ERROR;
      project.runtimeLastError = this.toErrorMessage(error);
      await this.projectsRepository.save(project);
    }
  }

  private async handleDelete(project: Project): Promise<void> {
    try {
      if (project.status === ProjectStatus.ACTIVE) {
        return;
      }
      if (project.runtimeNetworkName) {
        await this.projectRuntimeNetworkService.removeWorkspaceNetwork(
          project.runtimeNetworkName,
        );
      }
      project.runtimeEnvironmentStatus = ProjectRuntimeEnvironmentStatus.ABSENT;
      project.runtimeProvisionedAt = null;
      project.runtimeLastError = null;
      await this.projectsRepository.save(project);
    } catch (error) {
      project.runtimeEnvironmentStatus = ProjectRuntimeEnvironmentStatus.ERROR;
      project.runtimeLastError = this.toErrorMessage(error);
      await this.projectsRepository.save(project);
    }
  }

  private async ensureRuntimeMetadata(
    project: Project,
    overrides: Partial<Project>,
  ): Promise<Project> {
    project.runtimeNetworkName =
      project.runtimeNetworkName ??
      this.projectRuntimeNetworkService.deriveWorkspaceNetworkName(project.id);
    Object.assign(project, overrides);
    return this.projectsRepository.save(project);
  }

  private async assertNoActiveRuns(projectId: string): Promise<void> {
    const activeRuns = await this.listActiveRuns(projectId);
    if (activeRuns.length > 0) {
      throw new ConflictException(
        'No se puede destruir el runtime mientras existan runs activos para el proyecto.',
      );
    }
  }

  private async listActiveRuns(
    projectId: string,
  ): Promise<ProjectRuntimeActiveRunSummary[]> {
    const runs = await this.buildRunsRepository
      .createQueryBuilder('run')
      .innerJoin(Delivery, 'delivery', 'delivery.id = run.deliveryId')
      .innerJoin('delivery.assignment', 'assignment')
      .where('assignment.projectId = :projectId', { projectId })
      .andWhere('run.status IN (:...statuses)', {
        statuses: ACTIVE_RUN_STATUSES,
      })
      .orderBy('run.createdAt', 'DESC')
      .getMany();

    return runs.map((run) => ({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      status: run.status,
      activeStage: run.activeStage,
      executionNetworkName:
        typeof run.runtimeTarget?.executionNetworkName === 'string'
          ? run.runtimeTarget.executionNetworkName
          : null,
      primaryContainerId:
        typeof run.runtimeTarget?.primaryContainerId === 'string'
          ? run.runtimeTarget.primaryContainerId
          : null,
      helperContainerIds: Array.isArray(run.runtimeTarget?.helperContainerIds)
        ? run.runtimeTarget.helperContainerIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.length > 0,
          )
        : [],
      createdAt: run.createdAt.toISOString(),
    }));
  }

  private async findManagedProjectOrThrow(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (actor.role !== UserRole.ADMIN && project.creatorId !== actor.userId) {
      throw new ForbiddenException(
        'No tiene permisos para gestionar el runtime de este proyecto.',
      );
    }
    return project;
  }

  private async enqueueJob(
    projectId: string,
    action: ProjectRuntimeJobData['action'],
    forceNew: boolean = false,
  ): Promise<void> {
    const baseJobId = `project-runtime-${action}-${projectId}`;
    const options: JobsOptions = {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
      jobId: forceNew ? `${baseJobId}-${Date.now()}` : baseJobId,
    };
    await this.runtimeQueue.add(
      PROJECT_RUNTIME_JOB_NAME,
      { projectId, action } satisfies ProjectRuntimeJobData,
      options,
    );
  }

  async enqueueRuntimeDeletion(projectId: string): Promise<void> {
    await this.enqueueJob(projectId, 'delete', true);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error operativo no tipado en runtime del proyecto.';
  }
}
