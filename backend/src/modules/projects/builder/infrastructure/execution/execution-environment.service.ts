import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_KIND_CLUSTER_NAME,
  DEFAULT_STABILITY_WINDOW_SECONDS,
  DEFAULT_BATCH_TIMEOUT_SECONDS,
  DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
} from '../../domain/builder.constants';
import { ExecutionContext } from '../../domain/builder.types';
import { buildLogTail, runCommand } from '../utils/command-runner.util';
import { CommandExecutionResult } from './execution.types';
import { KubectlExecutionService } from './kubectl-execution.service';

@Injectable()
export class ExecutionEnvironmentService {
  private readonly dockerBuildTimeoutMs: number;
  private readonly batchTimeoutSeconds: number;
  private readonly serviceReadyTimeoutSeconds: number;
  private readonly stabilityWindowSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly kubectlExecutionService: KubectlExecutionService,
  ) {
    this.dockerBuildTimeoutMs = this.configService.get<number>(
      'BUILDER_DOCKER_BUILD_TIMEOUT_MS',
      DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
    );
    this.batchTimeoutSeconds = this.configService.get<number>(
      'BUILDER_BATCH_TIMEOUT_SECONDS',
      DEFAULT_BATCH_TIMEOUT_SECONDS,
    );
    this.serviceReadyTimeoutSeconds = this.configService.get<number>(
      'BUILDER_SERVICE_READY_TIMEOUT_SECONDS',
      DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
    );
    this.stabilityWindowSeconds = this.configService.get<number>(
      'BUILDER_STABILITY_WINDOW_SECONDS',
      DEFAULT_STABILITY_WINDOW_SECONDS,
    );
  }

  async collectExecutionContext(baseImage: string): Promise<ExecutionContext> {
    const dockerVersion = await this.tryVersion('docker', ['--version']);
    const kindVersion = await this.kubectlExecutionService.tryVersion('kind', [
      '--version',
    ]);
    const kubectlVersion = await this.kubectlExecutionService.tryVersion(
      'kubectl',
      ['version', '--client', '--short'],
    );
    const pythonBaseImageDigest = await this.tryImageDigest(baseImage);

    return {
      pythonBaseImage: baseImage,
      pythonBaseImageDigest,
      dockerVersion,
      kindVersion,
      kubectlVersion,
      clusterName: this.resolveClusterName(),
      limits: {
        batchTimeoutSeconds: this.batchTimeoutSeconds,
        serviceReadyTimeoutSeconds: this.serviceReadyTimeoutSeconds,
        stabilityWindowSeconds: this.stabilityWindowSeconds,
      },
    };
  }

  async assertDockerAvailable(): Promise<void> {
    const result = await runCommand(
      'docker',
      ['info', '--format', '{{.ServerVersion}}'],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      },
    );
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `Docker daemon no disponible: ${result.stderr.trim() || 'sin detalle.'}`,
      );
    }
  }

  async assertKubernetesTooling(): Promise<void> {
    await this.kubectlExecutionService.assertCommandAvailable('kind', [
      '--version',
    ]);
    await this.kubectlExecutionService.assertCommandAvailable('kubectl', [
      'version',
      '--client',
    ]);
  }

  async dockerBuild(
    projectRootDir: string,
    imageTag: string,
  ): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const result = await runCommand('docker', ['build', '-t', imageTag, '.'], {
      cwd: projectRootDir,
      timeoutMs: this.dockerBuildTimeoutMs,
      maxBufferedChars: 1_500_000,
    });

    const combinedLogs = `${result.stdout}\n${result.stderr}`.trim();
    return {
      exitCode: result.timedOut ? -1 : result.exitCode,
      durationMs: Date.now() - startedAt,
      logsTail: buildLogTail(combinedLogs, 120),
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
    };
  }

  async loadImageInKind(imageTag: string): Promise<void> {
    const result = await runCommand(
      'kind',
      ['load', 'docker-image', imageTag, '--name', this.resolveClusterName()],
      {
        timeoutMs: this.kubectlExecutionService.getTimeoutMs(),
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo cargar imagen en kind: ${result.stderr.trim() || result.stdout.trim() || 'sin detalle.'}`,
      );
    }
  }

  async removeDockerImage(imageTag: string): Promise<boolean> {
    const result = await runCommand('docker', ['image', 'rm', imageTag], {
      timeoutMs: 30000,
    });
    return !result.timedOut && result.exitCode === 0;
  }

  private async tryImageDigest(imageRef: string): Promise<string | null> {
    const result = await runCommand(
      'docker',
      ['image', 'inspect', imageRef, '--format', '{{index .RepoDigests 0}}'],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      return null;
    }

    const digest = result.stdout.trim();
    return digest || null;
  }

  private async tryVersion(
    command: string,
    args: string[],
  ): Promise<string | null> {
    try {
      const result = await runCommand(command, args, {
        timeoutMs: this.kubectlExecutionService.getTimeoutMs(),
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

  private resolveClusterName(): string {
    return (
      this.configService.get<string>(
        'BUILDER_KIND_CLUSTER_NAME',
        DEFAULT_KIND_CLUSTER_NAME,
      ) ?? DEFAULT_KIND_CLUSTER_NAME
    );
  }
}
