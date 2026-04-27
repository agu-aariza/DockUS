import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runCommand } from '../builder/infrastructure/utils/command-runner.util';
import {
  DEFAULT_PROJECT_RUNTIME_DELETE_TIMEOUT_MS,
  DEFAULT_PROJECT_RUNTIME_INSPECT_TIMEOUT_MS,
  DEFAULT_PROJECT_RUNTIME_KIND_PREFIX,
  DEFAULT_PROJECT_RUNTIME_PROVISION_TIMEOUT_MS,
} from './project-runtime.constants';
import {
  ProjectRuntimeNamespaceSummary,
  ProjectRuntimePodSummary,
} from './project-runtime.types';

@Injectable()
export class ProjectRuntimeClusterService {
  private readonly kindPrefix: string;
  private readonly provisionTimeoutMs: number;
  private readonly deleteTimeoutMs: number;
  private readonly inspectTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.kindPrefix =
      this.configService.get<string>(
        'PROJECT_RUNTIME_KIND_PREFIX',
        DEFAULT_PROJECT_RUNTIME_KIND_PREFIX,
      ) ?? DEFAULT_PROJECT_RUNTIME_KIND_PREFIX;
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

  deriveClusterName(projectId: string): string {
    return `${this.kindPrefix}-${projectId.slice(0, 12).toLowerCase()}`;
  }

  async createCluster(clusterName: string): Promise<void> {
    if (await this.clusterExists(clusterName)) {
      await this.exportKubeconfig(clusterName);
      await this.assertClusterReady(clusterName);
      return;
    }

    await this.assertCommandAvailable('kind', ['--version']);
    await this.assertCommandAvailable('kubectl', ['version', '--client']);

    const result = await runCommand(
      'kind',
      ['create', 'cluster', '--name', clusterName],
      {
        timeoutMs: this.provisionTimeoutMs,
        maxBufferedChars: 1_500_000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo crear el cluster ${clusterName}: ${this.normalizeError(result)}`,
      );
    }

    await this.exportKubeconfig(clusterName);
    await this.assertClusterReady(clusterName);
  }

  async exportKubeconfig(clusterName: string): Promise<void> {
    const result = await runCommand(
      'kind',
      ['export', 'kubeconfig', '--name', clusterName, '--internal'],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo exportar el kubeconfig para ${clusterName}: ${this.normalizeError(result)}`,
      );
    }
  }

  async deleteCluster(clusterName: string): Promise<void> {
    if (!(await this.clusterExists(clusterName))) {
      return;
    }

    const result = await runCommand(
      'kind',
      ['delete', 'cluster', '--name', clusterName],
      {
        timeoutMs: this.deleteTimeoutMs,
        maxBufferedChars: 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo eliminar el cluster ${clusterName}: ${this.normalizeError(result)}`,
      );
    }
  }

  async assertClusterReady(clusterName: string): Promise<void> {
    const result = await runCommand(
      'kubectl',
      ['--context', this.contextName(clusterName), 'cluster-info'],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 250000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `El cluster ${clusterName} no está listo: ${this.normalizeError(result)}`,
      );
    }
  }

  async clusterExists(clusterName: string): Promise<boolean> {
    const result = await runCommand('kind', ['get', 'clusters'], {
      timeoutMs: this.inspectTimeoutMs,
      maxBufferedChars: 250000,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo consultar clusters kind: ${this.normalizeError(result)}`,
      );
    }
    return result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .includes(clusterName);
  }

  async listNamespacesAndPods(
    clusterName: string,
    namespacePrefix: string,
  ): Promise<ProjectRuntimeNamespaceSummary[]> {
    const namespacesPayload = await this.runKubectlJson(clusterName, [
      'get',
      'namespaces',
      '-o',
      'json',
    ]);
    const podsPayload = await this.runKubectlJson(clusterName, [
      'get',
      'pods',
      '--all-namespaces',
      '-o',
      'json',
    ]);

    const namespaces = Array.isArray(namespacesPayload.items)
      ? namespacesPayload.items
      : [];
    const pods = Array.isArray(podsPayload.items) ? podsPayload.items : [];

    return namespaces
      .filter((item) => {
        const name = this.readString(item?.metadata?.name);
        return Boolean(name && name.startsWith(`${namespacePrefix}-`));
      })
      .map((item) => {
        const namespaceName =
          this.readString(item?.metadata?.name) ?? 'unknown';
        const namespacePods = pods
          .filter(
            (pod) =>
              this.readString(pod?.metadata?.namespace) === namespaceName,
          )
          .map((pod) => this.toPodSummary(pod));
        return {
          name: namespaceName,
          phase:
            item?.status?.phase === 'Active'
              ? 'Active'
              : item?.metadata?.deletionTimestamp
                ? 'Terminating'
                : 'Unknown',
          pods: namespacePods,
        } satisfies ProjectRuntimeNamespaceSummary;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private async runKubectlJson(
    clusterName: string,
    args: string[],
  ): Promise<Record<string, unknown>> {
    const result = await runCommand(
      'kubectl',
      ['--context', this.contextName(clusterName), ...args],
      {
        timeoutMs: this.inspectTimeoutMs,
        maxBufferedChars: 1_500_000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar el cluster ${clusterName}: ${this.normalizeError(result)}`,
      );
    }

    return JSON.parse(result.stdout || '{}') as Record<string, unknown>;
  }

  private async assertCommandAvailable(
    command: string,
    args: string[],
  ): Promise<void> {
    const result = await runCommand(command, args, {
      timeoutMs: this.inspectTimeoutMs,
      maxBufferedChars: 50000,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `${command} no disponible: ${this.normalizeError(result)}`,
      );
    }
  }

  private contextName(clusterName: string): string {
    return `kind-${clusterName}`;
  }

  private toPodSummary(pod: any): ProjectRuntimePodSummary {
    const containerStatuses = Array.isArray(pod?.status?.containerStatuses)
      ? pod.status.containerStatuses
      : [];
    return {
      name: this.readString(pod?.metadata?.name) ?? 'unknown',
      phase: this.readString(pod?.status?.phase) ?? 'Unknown',
      readyContainers: containerStatuses.filter(
        (status) => status?.ready === true,
      ).length,
      totalContainers: containerStatuses.length,
      restartCount: containerStatuses.reduce(
        (sum, status) =>
          sum +
          (typeof status?.restartCount === 'number' ? status.restartCount : 0),
        0,
      ),
    };
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
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
