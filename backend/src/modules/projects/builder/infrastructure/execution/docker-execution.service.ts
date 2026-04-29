import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerService } from '../../../../../shared/infrastructure/docker/docker-container.service';
import { DockerNetworkService } from '../../../../../shared/infrastructure/docker/docker-network.service';
import {
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_RUNTIME,
} from '../../domain/builder.constants';

export interface DockerCreateNetworkOptions {
  internal?: boolean;
  labels?: Record<string, string>;
}

export interface DockerRunOptions {
  containerName: string;
  imageTag: string;
  command: string[];
  networkName?: string;
  networkMode?: 'none';
  networkAlias?: string;
  labels?: Record<string, string>;
  cpus?: string;
  memory?: string;
  ports?: Array<{
    containerPort: number;
    hostPort?: number;
    protocol?: 'tcp' | 'udp';
  }>;
}

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
    options: DockerCreateNetworkOptions = {},
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
    return this.dockerContainerService.inspectContainer<Record<string, unknown>>(
      containerId,
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 500000,
      },
    );
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
