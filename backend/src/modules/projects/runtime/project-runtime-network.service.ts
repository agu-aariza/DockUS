import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runCommand } from '../builder/infrastructure/utils/command-runner.util';
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

  constructor(private readonly configService: ConfigService) {
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
    if (await this.networkExists(networkName)) {
      return;
    }

    const result = await runCommand(
      'docker',
      [
        'network',
        'create',
        '--label',
        'dockus.managed=true',
        '--label',
        'dockus.scope=workspace',
        ...(projectId ? ['--label', `dockus.projectId=${projectId}`] : []),
        networkName,
      ],
      {
        timeoutMs: this.provisionTimeoutMs,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo crear la red workspace ${networkName}: ${this.normalizeError(result)}`,
      );
    }
  }

  async removeWorkspaceNetwork(networkName: string): Promise<void> {
    if (!(await this.networkExists(networkName))) {
      return;
    }

    const result = await runCommand(
      'docker',
      ['network', 'rm', networkName],
      {
        timeoutMs: this.deleteTimeoutMs,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo eliminar la red workspace ${networkName}: ${this.normalizeError(result)}`,
      );
    }
  }

  async listManagedNetworksAndContainers(
    workspaceNetworkName: string,
    executionNetworkPrefix: string,
  ): Promise<ProjectRuntimeNetworkSummary[]> {
    const listedNetworks = await this.listNetworks();
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
      const inspect = await this.inspectNetwork(networkName);
      const containers = await Promise.all(
        Object.keys(inspect.Containers ?? {}).map((containerId) =>
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
    const result = await runCommand(
      'docker',
      ['info', '--format', '{{.ServerVersion}}'],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `Docker daemon no disponible: ${this.normalizeError(result)}`,
      );
    }
  }

  private async networkExists(networkName: string): Promise<boolean> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 250000,
      },
    );
    if (!result.timedOut && result.exitCode === 0) {
      return true;
    }
    if (
      /No such network/u.test(result.stderr) ||
      /No such network/u.test(result.stdout)
    ) {
      return false;
    }
    if (result.timedOut) {
      throw new ServiceUnavailableException(
        `Timeout inspeccionando la red ${networkName}.`,
      );
    }
    if (result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la red ${networkName}: ${this.normalizeError(result)}`,
      );
    }
    return false;
  }

  private async listNetworks(): Promise<Array<{ Name?: string }>> {
    const result = await runCommand(
      'docker',
      ['network', 'ls', '--format', '{{json .}}'],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudieron listar redes Docker: ${this.normalizeError(result)}`,
      );
    }
    return result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { Name?: string });
  }

  private async inspectNetwork(networkName: string): Promise<{
    Containers?: Record<string, unknown>;
  }> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la red ${networkName}: ${this.normalizeError(result)}`,
      );
    }
    const payload = JSON.parse(result.stdout || '[]') as Array<{
      Containers?: Record<string, unknown>;
    }>;
    return payload[0] ?? {};
  }

  private async toContainerSummary(
    containerId: string,
  ): Promise<ProjectRuntimeContainerSummary | null> {
    const result = await runCommand(
      'docker',
      ['container', 'inspect', containerId],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 250000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      return null;
    }

    const payload = JSON.parse(result.stdout || '[]') as DockerContainerInspect[];
    const container = payload[0];
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

  private normalizeError(result: {
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }): string {
    if (result.timedOut) {
      return 'timeout';
    }
    return (result.stderr || result.stdout).trim() || 'sin detalle';
  }
}
