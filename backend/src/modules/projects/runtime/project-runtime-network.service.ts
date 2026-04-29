import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from '../../../shared/infrastructure/docker/docker-container.service';
import { DockerHostService } from '../../../shared/infrastructure/docker/docker-host.service';
import { DockerNetworkService } from '../../../shared/infrastructure/docker/docker-network.service';
import {
  DEFAULT_PROJECT_RUNTIME_DELETE_TIMEOUT_MS,
  DEFAULT_PROJECT_RUNTIME_INSPECT_TIMEOUT_MS,
  DEFAULT_PROJECT_RUNTIME_PROVISION_TIMEOUT_MS,
  DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX,
} from './project-runtime.constants';
import {
  ProjectRuntimeContainerSummary,
  ProjectRuntimeNetworkSummary,
} from './project-runtime.types';

type DockerContainerInspect = {
  Id?: string;
  Name?: string;
  RestartCount?: number;
  State?: {
    Status?: string;
  };
};

@Injectable()
export class ProjectRuntimeNetworkService {
  private readonly workspaceNetworkPrefix: string;
  private readonly provisionTimeoutMs: number;
  private readonly deleteTimeoutMs: number;
  private readonly inspectTimeoutMs: number;
  private readonly sandboxRuntime: string;
  private readonly nodeEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dockerHostService: DockerHostService,
    private readonly dockerNetworkService: DockerNetworkService,
    private readonly dockerContainerService: DockerContainerService,
  ) {
    this.workspaceNetworkPrefix =
      this.configService.get<string>(
        'BUILDER_WORKSPACE_NETWORK_PREFIX',
        DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX,
      ) ?? DEFAULT_PROJECT_RUNTIME_WORKSPACE_NETWORK_PREFIX;
    this.provisionTimeoutMs = this.configService.get<number>(
      'PROJECT_RUNTIME_PROVISION_TIMEOUT_MS',
      DEFAULT_PROJECT_RUNTIME_PROVISION_TIMEOUT_MS,
    );
    this.deleteTimeoutMs = this.configService.get<number>(
      'PROJECT_RUNTIME_DELETE_TIMEOUT_MS',
      DEFAULT_PROJECT_RUNTIME_DELETE_TIMEOUT_MS,
    );
    this.inspectTimeoutMs = this.configService.get<number>(
      'PROJECT_RUNTIME_INSPECT_TIMEOUT_MS',
      DEFAULT_PROJECT_RUNTIME_INSPECT_TIMEOUT_MS,
    );
    this.sandboxRuntime =
      this.configService.get<string>('BUILDER_DOCKER_RUNTIME', 'runc') ??
      'runc';
    this.nodeEnv =
      this.configService.get<string>('NODE_ENV', 'development') ??
      'development';
  }

  deriveWorkspaceNetworkName(projectId: string): string {
    return `${this.workspaceNetworkPrefix}-${projectId
      .slice(0, 12)
      .toLowerCase()}`;
  }

  async ensureWorkspaceNetwork(
    networkName: string,
    projectId?: string,
  ): Promise<void> {
    await this.assertDockerAvailable();
    await this.dockerNetworkService.createNetwork(networkName, {
      internal: true,
      labels: {
        'dockus.managed': 'true',
        'dockus.scope': 'workspace',
        ...(projectId ? { 'dockus.projectId': projectId } : {}),
      },
      timeoutMs: this.provisionTimeoutMs,
      maxBufferedChars: 50000,
    });
  }

  async removeWorkspaceNetwork(networkName: string): Promise<void> {
    if (
      !(await this.dockerNetworkService.networkExists(networkName, {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 250000,
      }))
    ) {
      return;
    }

    const removed = await this.dockerNetworkService.removeNetwork(networkName, {
      timeoutMs: this.deleteTimeoutMs,
      maxBufferedChars: 50000,
    });
    if (!removed) {
      throw new ServiceUnavailableException(
        `No se pudo eliminar la red workspace ${networkName}.`,
      );
    }
  }

  async listManagedNetworksAndContainers(
    projectId: string,
    workspaceNetworkName: string,
    executionNetworkPrefix: string,
  ): Promise<ProjectRuntimeNetworkSummary[]> {
    const listedNetworks = await this.dockerNetworkService.listNetworks<{
      Name?: string;
    }>({
      labels: { 'dockus.projectId': projectId },
      timeoutMs: this.inspectTimeoutMs,
      maxBufferedChars: 500000,
    });
    const relevantNames = listedNetworks
      .map((network) => network.Name)
      .filter(
        (name): name is string =>
          typeof name === 'string' &&
          (name === workspaceNetworkName ||
            name.startsWith(`${executionNetworkPrefix}-`)),
      )
      .sort((left, right) => left.localeCompare(right));

    const summaries: ProjectRuntimeNetworkSummary[] = [];
    for (const networkName of relevantNames) {
      const inspect =
        await this.dockerNetworkService.inspectNetwork<{
          Containers?: Record<string, unknown>;
        }>(networkName, {
          timeoutMs: this.inspectTimeoutMs,
          maxBufferedChars: 500000,
        });
      const containers = await Promise.all(
        Object.keys(inspect?.Containers ?? {}).map((containerId) =>
          this.toContainerSummary(containerId),
        ),
      );
      summaries.push({
        name: networkName,
        scope:
          networkName === workspaceNetworkName
            ? 'workspace'
            : networkName.startsWith(`${executionNetworkPrefix}-`)
              ? 'run'
              : 'unknown',
        containers: containers.filter(
          (
            container,
          ): container is ProjectRuntimeContainerSummary => container !== null,
        ),
      });
    }

    return summaries;
  }

  private async assertDockerAvailable(): Promise<void> {
    await this.dockerHostService.assertDockerAvailable({
      nodeEnv: this.nodeEnv,
      sandboxRuntime: this.sandboxRuntime,
      timeoutMs: this.inspectTimeoutMs,
      maxBufferedChars: 50000,
    });
  }

  private async toContainerSummary(
    containerId: string,
  ): Promise<ProjectRuntimeContainerSummary | null> {
    const container =
      await this.dockerContainerService.inspectContainer<DockerContainerInspect>(
        containerId,
        {
          timeoutMs: this.inspectTimeoutMs,
          maxBufferedChars: 250000,
        },
      );
    if (!container?.Id) {
      return null;
    }

    return {
      id: container.Id,
      name: container.Name?.replace(/^\//u, '') ?? container.Id.slice(0, 12),
      state: container.State?.Status ?? 'unknown',
      status: container.State?.Status ?? 'unknown',
      restartCount:
        typeof container.RestartCount === 'number'
          ? container.RestartCount
          : 0,
    };
  }
}
