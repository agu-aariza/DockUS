import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_KIND_CLUSTER_NAME,
  DEFAULT_KUBECTL_TIMEOUT_MS,
  DEFAULT_LOG_TAIL_LINES,
} from '../../domain/builder.constants';
import { buildLogTail, runCommand } from '../utils/command-runner.util';
import { CommandExecutionResult } from './execution.types';

@Injectable()
export class KubectlExecutionService {
  private readonly kubectlTimeoutMs: number;
  private readonly clusterName: string;

  constructor(private readonly configService: ConfigService) {
    this.kubectlTimeoutMs = this.configService.get<number>(
      'BUILDER_KUBECTL_TIMEOUT_MS',
      DEFAULT_KUBECTL_TIMEOUT_MS,
    );
    this.clusterName = this.configService.get<string>(
      'BUILDER_KIND_CLUSTER_NAME',
      DEFAULT_KIND_CLUSTER_NAME,
    );
  }

  getTimeoutMs(): number {
    return this.kubectlTimeoutMs;
  }

  async assertCommandAvailable(command: string, args: string[]): Promise<void> {
    const result = await runCommand(command, args, {
      timeoutMs: this.kubectlTimeoutMs,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `${command} no disponible: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  async applyManifest(namespace: string, manifest: string): Promise<void> {
    const result = await runCommand(
      'kubectl',
      [
        '--context',
        `kind-${this.clusterName}`,
        '-n',
        namespace,
        'apply',
        '-f',
        '-',
      ],
      {
        timeoutMs: this.kubectlTimeoutMs,
        stdin: manifest,
      },
    );
    if (result.exitCode !== 0 || result.timedOut) {
      throw new ServiceUnavailableException(
        `kubectl apply falló: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  async runKubectl(args: string[], namespace?: string): Promise<void> {
    const result = await this.runKubectlResult(
      args,
      namespace,
      this.kubectlTimeoutMs,
    );
    if (result.exitCode !== 0 || result.timedOut) {
      throw new ServiceUnavailableException(
        `kubectl ${args.join(' ')} falló: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  async runKubectlResult(
    args: string[],
    namespace: string | undefined,
    timeoutMs: number,
  ): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const commandArgs = [
      '--context',
      `kind-${this.clusterName}`,
      ...(namespace ? ['-n', namespace] : []),
      ...args,
    ];
    const result = await runCommand('kubectl', commandArgs, {
      timeoutMs,
      maxBufferedChars: 1_500_000,
    });
    const combinedLogs = `${result.stdout}\n${result.stderr}`.trim();
    return {
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      logsTail: buildLogTail(combinedLogs, DEFAULT_LOG_TAIL_LINES),
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
    };
  }

  async collectPodLogs(namespace: string, podName: string): Promise<string> {
    const result = await this.runKubectlResult(
      ['logs', podName, '--timestamps=true'],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async collectPodDescribe(
    namespace: string,
    podName: string,
  ): Promise<string> {
    const result = await this.runKubectlResult(
      ['describe', 'pod', podName],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async collectEvents(namespace: string): Promise<string> {
    const result = await this.runKubectlResult(
      ['get', 'events', '-o', 'json'],
      namespace,
      this.kubectlTimeoutMs,
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async tryResolvePodName(
    namespace: string,
    selectors: string[],
  ): Promise<string | null> {
    const selector = selectors.join(',');
    const result = await this.runKubectlResult(
      [
        'get',
        'pods',
        '-l',
        selector,
        '-o',
        'jsonpath={.items[0].metadata.name}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    const podName = result.stdout.trim();
    return podName || null;
  }

  async runTcpProbe(
    namespace: string,
    serviceName: string,
    port: number,
  ): Promise<boolean> {
    const endpointResult = await this.runKubectlResult(
      [
        'get',
        'endpoints',
        serviceName,
        '-o',
        'jsonpath={.subsets[0].ports[0].port}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    if (endpointResult.exitCode !== 0 || endpointResult.timedOut) {
      return false;
    }
    return endpointResult.stdout.trim() === String(port);
  }

  async evaluateStability(
    namespace: string,
    podName: string | null,
    windowSeconds: number,
  ): Promise<boolean> {
    if (!podName) {
      return false;
    }
    const initialRestarts = await this.resolvePodRestartCount(
      namespace,
      podName,
    );
    if (initialRestarts < 0) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, windowSeconds * 1000));
    const finalRestarts = await this.resolvePodRestartCount(namespace, podName);
    return finalRestarts === initialRestarts;
  }

  async tryVersion(command: string, args: string[]): Promise<string | null> {
    try {
      const result = await runCommand(command, args, {
        timeoutMs: this.kubectlTimeoutMs,
      });
      if (result.exitCode !== 0 || result.timedOut) {
        return null;
      }
      return (
        result.stdout.trim().slice(0, 120) ||
        result.stderr.trim().slice(0, 120) ||
        null
      );
    } catch {
      return null;
    }
  }

  private async resolvePodRestartCount(
    namespace: string,
    podName: string,
  ): Promise<number> {
    const result = await this.runKubectlResult(
      [
        'get',
        'pod',
        podName,
        '-o',
        'jsonpath={.status.containerStatuses[0].restartCount}',
      ],
      namespace,
      this.kubectlTimeoutMs,
    );
    const parsed = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(parsed) ? parsed : -1;
  }
}
