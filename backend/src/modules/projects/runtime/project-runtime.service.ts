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
  ProjectClusterStatus,
  ProjectStatus,
} from '../entities/project.entity';
import {
  DEFAULT_PROJECT_RUNTIME_KIND_PREFIX,
  PROJECT_RUNTIME_JOB_NAME,
  PROJECT_RUNTIME_QUEUE_NAME,
} from './project-runtime.constants';
import { ProjectRuntimeClusterService } from './project-runtime-cluster.service';
import {
  ProjectRuntimeActiveRunSummary,
  ProjectRuntimeJobData,
  ProjectRuntimeNamespaceSummary,
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
  private readonly namespacePrefix: string;

  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    @InjectQueue(PROJECT_RUNTIME_QUEUE_NAME)
    private readonly runtimeQueue: Queue,
    private readonly projectRuntimeClusterService: ProjectRuntimeClusterService,
    private readonly configService: ConfigService,
  ) {
    this.namespacePrefix =
      this.configService.get<string>(
        'BUILDER_K8S_NAMESPACE_PREFIX',
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
      runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
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
        project.runtimeClusterStatus === ProjectClusterStatus.READY &&
        project.runtimeClusterName
      ) {
        return this.projectsRepository.save(project);
      }
      const saved = await this.ensureRuntimeMetadata(project, {
        status: ProjectStatus.ACTIVE,
        runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
        runtimeLastError: null,
      });
      await this.enqueueJob(saved.id, 'provision');
      return saved;
    }

    await this.assertNoActiveRuns(project.id);
    const desiredStatus =
      project.runtimeClusterName &&
      project.runtimeClusterStatus !== ProjectClusterStatus.ABSENT
        ? ProjectClusterStatus.DELETING
        : ProjectClusterStatus.ABSENT;

    project.status = targetStatus;
    project.runtimeClusterStatus = desiredStatus;
    project.runtimeLastError = null;
    if (desiredStatus === ProjectClusterStatus.ABSENT) {
      project.runtimeProvisionedAt = null;
    }
    const saved = await this.projectsRepository.save(project);
    if (desiredStatus === ProjectClusterStatus.DELETING) {
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
    let namespaces: ProjectRuntimeNamespaceSummary[] = [];
    if (
      project.runtimeClusterName &&
      project.runtimeClusterStatus === ProjectClusterStatus.READY
    ) {
      try {
        namespaces =
          await this.projectRuntimeClusterService.listNamespacesAndPods(
            project.runtimeClusterName,
            this.namespacePrefix,
          );
      } catch {
        namespaces = [];
      }
    }

    return {
      projectId: project.id,
      clusterName: project.runtimeClusterName,
      status: project.runtimeClusterStatus,
      provisionedAt: project.runtimeProvisionedAt?.toISOString() ?? null,
      lastError: project.runtimeLastError,
      activeRuns,
      namespaces,
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
      project.runtimeClusterStatus !== ProjectClusterStatus.ERROR &&
      project.runtimeClusterStatus !== ProjectClusterStatus.ABSENT
    ) {
      throw new ConflictException(
        `El runtime del proyecto está en ${project.runtimeClusterStatus} y no admite reconcile manual.`,
      );
    }

    const saved = await this.ensureRuntimeMetadata(project, {
      runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
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
    const clusterName = this.assertProjectRuntimeReady(project);
    return {
      projectId: project.id,
      clusterName,
      namespace: `${this.namespacePrefix}-${runId.slice(0, 8).toLowerCase()}`,
      primaryPodName: null,
      helperPodNames: [] as string[],
    };
  }

  assertProjectRuntimeReady(project: Project): string {
    if (project.status !== ProjectStatus.ACTIVE) {
      throw new ConflictException('La ejecución requiere un proyecto ACTIVE.');
    }
    if (
      project.runtimeClusterStatus !== ProjectClusterStatus.READY ||
      !project.runtimeClusterName
    ) {
      throw new ConflictException(
        `El runtime del proyecto no está listo (${project.runtimeClusterStatus}).`,
      );
    }
    return project.runtimeClusterName;
  }

  private async reconcileActiveProjectsOnStartup(): Promise<void> {
    const projects = await this.projectsRepository.find({
      where: {
        status: ProjectStatus.ACTIVE,
      },
    });

    for (const project of projects) {
      if (project.runtimeClusterStatus === ProjectClusterStatus.READY) {
        continue;
      }
      const saved = await this.ensureRuntimeMetadata(project, {
        runtimeClusterStatus: ProjectClusterStatus.PROVISIONING,
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
      const runtimeClusterName =
        project.runtimeClusterName ??
        this.projectRuntimeClusterService.deriveClusterName(project.id);

      this.logger.log(
        `Iniciando creación/verificación de cluster: ${runtimeClusterName}`,
      );

      if (project.runtimeClusterName !== runtimeClusterName) {
        project.runtimeClusterName = runtimeClusterName;
        project.runtimeClusterStatus = ProjectClusterStatus.PROVISIONING;
        project.runtimeLastError = null;
        await this.projectsRepository.save(project);
      }

      await this.projectRuntimeClusterService.createCluster(runtimeClusterName);

      this.logger.log(`Cluster ${runtimeClusterName} está READY.`);

      project.runtimeClusterStatus = ProjectClusterStatus.READY;
      project.runtimeProvisionedAt = new Date();
      project.runtimeLastError = null;
      await this.projectsRepository.save(project);
    } catch (error) {
      this.logger.error(
        `Error en provisión de cluster para proyecto ${project.id}: ${this.toErrorMessage(error)}`,
      );
      project.runtimeClusterStatus = ProjectClusterStatus.ERROR;
      project.runtimeLastError = this.toErrorMessage(error);
      await this.projectsRepository.save(project);
    }
  }

  private async handleDelete(project: Project): Promise<void> {
    try {
      if (project.status === ProjectStatus.ACTIVE) {
        return;
      }
      if (project.runtimeClusterName) {
        await this.projectRuntimeClusterService.deleteCluster(
          project.runtimeClusterName,
        );
      }
      project.runtimeClusterStatus = ProjectClusterStatus.ABSENT;
      project.runtimeProvisionedAt = null;
      project.runtimeLastError = null;
      await this.projectsRepository.save(project);
    } catch (error) {
      project.runtimeClusterStatus = ProjectClusterStatus.ERROR;
      project.runtimeLastError = this.toErrorMessage(error);
      await this.projectsRepository.save(project);
    }
  }

  private async ensureRuntimeMetadata(
    project: Project,
    overrides: Partial<Project>,
  ): Promise<Project> {
    project.runtimeClusterName =
      project.runtimeClusterName ??
      this.projectRuntimeClusterService.deriveClusterName(project.id);
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
      namespace:
        typeof run.runtimeTarget?.namespace === 'string'
          ? run.runtimeTarget.namespace
          : null,
      primaryPodName:
        typeof run.runtimeTarget?.primaryPodName === 'string'
          ? run.runtimeTarget.primaryPodName
          : null,
      helperPodNames: Array.isArray(run.runtimeTarget?.helperPodNames)
        ? run.runtimeTarget.helperPodNames.filter(
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

  async enqueueClusterDeletion(projectId: string): Promise<void> {
    await this.enqueueJob(projectId, 'delete', true);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Error operativo no tipado en runtime del proyecto.';
  }
}
