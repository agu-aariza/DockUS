import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildLogTail } from '../../../../../shared/infrastructure/docker/command-runner.util';
import { DockerHostService } from '../../../../../shared/infrastructure/docker/docker-host.service';
import { DockerImageService } from '../../../../../shared/infrastructure/docker/docker-image.service';
import {
  DEFAULT_DOCKER_BUILD_TIMEOUT_MS,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_STABILITY_WINDOW_SECONDS,
  DEFAULT_BATCH_TIMEOUT_SECONDS,
  DEFAULT_SERVICE_READY_TIMEOUT_SECONDS,
  DEFAULT_DOCKER_RUNTIME,
} from '../../domain/builder.constants';
import { ExecutionContext } from '../../domain/builder.types';
import { CommandExecutionResult } from './execution.types';

@Injectable()
export class ExecutionEnvironmentService {
  private readonly dockerBuildTimeoutMs: number;
  private readonly batchTimeoutSeconds: number;
  private readonly serviceReadyTimeoutSeconds: number;
  private readonly stabilityWindowSeconds: number;
  private readonly sandboxRuntime: string;
  private readonly nodeEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dockerHostService: DockerHostService,
    private readonly dockerImageService: DockerImageService,
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
    this.sandboxRuntime =
      this.configService.get<string>(
        'BUILDER_DOCKER_RUNTIME',
        DEFAULT_DOCKER_RUNTIME,
      ) ?? DEFAULT_DOCKER_RUNTIME;
    this.nodeEnv =
      this.configService.get<string>('NODE_ENV', 'development') ??
      'development';
  }

  async collectExecutionContext(
    baseImage: string,
    _workspaceNetworkName: string,
  ): Promise<ExecutionContext> {
    const dockerVersion = await this.dockerHostService.tryVersion(
      'docker',
      ['--version'],
      DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
    );
    const pythonBaseImageDigest = await this.dockerImageService.tryImageDigest(
      baseImage,
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      },
    );

    return {
      pythonBaseImage: baseImage,
      pythonBaseImageDigest,
      dockerVersion,
      runtimeBackend: 'docker-cli',
      sandboxRuntime: this.sandboxRuntime,
      sandboxNetworkPolicy: 'isolated',
      limits: {
        batchTimeoutSeconds: this.batchTimeoutSeconds,
        serviceReadyTimeoutSeconds: this.serviceReadyTimeoutSeconds,
        stabilityWindowSeconds: this.stabilityWindowSeconds,
      },
    };
  }

  async assertDockerAvailable(): Promise<void> {
    await this.dockerHostService.assertDockerAvailable({
      nodeEnv: this.nodeEnv,
      sandboxRuntime: this.sandboxRuntime,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
    });
  }

  async dockerBuild(
    projectRootDir: string,
    imageTag: string,
    options?: {
      onStdoutChunk?: (chunk: string) => void;
      onStderrChunk?: (chunk: string) => void;
    },
  ): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const result = await this.dockerImageService.buildImage(imageTag, {
      cwd: projectRootDir,
      timeoutMs: this.dockerBuildTimeoutMs,
      maxBufferedChars: 1_500_000,
      onStdoutChunk: options?.onStdoutChunk,
      onStderrChunk: options?.onStderrChunk,
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

  async removeDockerImage(imageTag: string): Promise<boolean> {
    return this.dockerImageService.removeImage(imageTag, {
      timeoutMs: 30000,
    });
  }
}
