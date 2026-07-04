import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from './docker-container.service';
import { DockerNetworkService } from './docker-network.service';
import {
  DockerCreateNetworkInfo,
  DockerRunOptions,
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
  DEFAULT_DOCKER_RUNTIME,
} from './docker.types';

@Injectable()
export class DockerExecutionService {
  private readonly dockerRuntime: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dockerNetworkService: DockerNetworkService,
    private readonly dockerContainerService: DockerContainerService,
  ) {
    this.dockerRuntime =
      this.configService.get<string>(
        'BUILDER_DOCKER_RUNTIME',
        DEFAULT_DOCKER_RUNTIME,
      ) ?? DEFAULT_DOCKER_RUNTIME;
  }

  async createNetwork(
    networkName: string,
    options: DockerCreateNetworkInfo = {},
  ): Promise<void> {
    await this.dockerNetworkService.createNetwork(networkName, {
      internal: options.internal,
      labels: options.labels,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }

  async removeNetwork(networkName: string): Promise<boolean> {
    return this.dockerNetworkService.removeNetwork(networkName, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }

  async inspectNetwork(
    networkName: string,
  ): Promise<Record<string, unknown> | null> {
    return this.dockerNetworkService.inspectNetwork<Record<string, unknown>>(
      networkName,
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 500000,
      },
    );
  }

  async runContainer(options: DockerRunOptions): Promise<string> {
    return this.dockerContainerService.runContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
  }

  async runDaemonContainer(options: DockerRunOptions): Promise<string> {
    return this.dockerContainerService.runDaemonContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
  }

  async runEphemeralContainer(
    options: DockerRunOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.dockerContainerService.runEphemeralContainer({
      ...options,
      runtime: this.dockerRuntime,
      timeoutMs: DEFAULT_DOCKER_EPHEMERAL_TIMEOUT_MS,
      maxBufferedChars: 250000, // Ephemeral commands could produce more output, but 250k is consistent
      onStdoutChunk: options.onStdoutChunk,
      onStderrChunk: options.onStderrChunk,
    });
  }

  async waitContainer(
    containerId: string,
    timeoutMs: number = DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  ): Promise<{ StatusCode: number; TimedOut?: boolean }> {
    return this.dockerContainerService.waitContainer(containerId, {
      timeoutMs,
      maxBufferedChars: 50000,
    });
  }

  async getContainerLogs(containerId: string): Promise<string> {
    return this.dockerContainerService.getContainerLogs(containerId, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 1_500_000,
    });
  }

  async inspectContainer(
    containerId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.dockerContainerService.inspectContainer<
      Record<string, unknown>
    >(containerId, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 500000,
    });
  }

  async removeContainer(
    containerId: string,
    force: boolean = true,
  ): Promise<boolean> {
    return this.dockerContainerService.removeContainer(containerId, {
      force,
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
  }
}
