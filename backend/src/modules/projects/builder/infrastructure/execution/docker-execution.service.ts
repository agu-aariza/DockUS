import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  DEFAULT_DOCKER_RUNTIME,
} from '../../domain/builder.constants';
import { runCommand } from '../utils/command-runner.util';

export interface DockerCreateNetworkOptions {
  labels?: Record<string, string>;
}

export interface DockerRunOptions {
  containerName: string;
  imageTag: string;
  command: string[];
  networkName: string;
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

  constructor(private readonly configService: ConfigService) {
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
    if (await this.networkExists(networkName)) {
      return;
    }

    const args = ['network', 'create', ...this.toLabelArgs(options.labels), networkName];
    const result = await runCommand('docker', args, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo crear la red ${networkName}: ${this.normalizeError(result)}`,
      );
    }
  }

  async removeNetwork(networkName: string): Promise<boolean> {
    const result = await runCommand('docker', ['network', 'rm', networkName], {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 50000,
    });
    return !result.timedOut && result.exitCode === 0;
  }

  async inspectNetwork(networkName: string): Promise<Record<string, unknown> | null> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 500000,
      },
    );
    if (
      !result.timedOut &&
      result.exitCode !== 0 &&
      /No such network/u.test(result.stderr || result.stdout)
    ) {
      return null;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la red ${networkName}: ${this.normalizeError(result)}`,
      );
    }

    const payload = JSON.parse(result.stdout || '[]') as Record<string, unknown>[];
    return payload[0] ?? null;
  }

  async runContainer(options: DockerRunOptions): Promise<string> {
    const containerId = await this.createContainer(options);
    await this.startContainer(containerId);
    return containerId;
  }

  async runDaemonContainer(options: DockerRunOptions): Promise<string> {
    const containerId = await this.createContainer(options);
    await this.startContainer(containerId);
    return containerId;
  }

  async waitContainer(
    containerId: string,
    timeoutMs: number = DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
  ): Promise<{ StatusCode: number; TimedOut?: boolean }> {
    const result = await runCommand(
      'docker',
      ['container', 'wait', containerId],
      {
        timeoutMs,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut) {
      return { StatusCode: -1, TimedOut: true };
    }
    if (result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo esperar al contenedor ${containerId}: ${this.normalizeError(result)}`,
      );
    }

    return {
      StatusCode: Number.parseInt(result.stdout.trim(), 10) || 0,
    };
  }

  async getContainerLogs(containerId: string): Promise<string> {
    const result = await runCommand(
      'docker',
      ['container', 'logs', containerId],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 1_500_000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      return `${result.stdout}\n${result.stderr}`.trim();
    }
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async inspectContainer(
    containerId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await runCommand(
      'docker',
      ['container', 'inspect', containerId],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 500000,
      },
    );
    if (
      !result.timedOut &&
      result.exitCode !== 0 &&
      /No such container/u.test(result.stderr || result.stdout)
    ) {
      return null;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar el contenedor ${containerId}: ${this.normalizeError(result)}`,
      );
    }
    const payload = JSON.parse(result.stdout || '[]') as Record<string, unknown>[];
    return payload[0] ?? null;
  }

  async removeContainer(
    containerId: string,
    force: boolean = true,
  ): Promise<boolean> {
    const result = await runCommand(
      'docker',
      ['container', 'rm', ...(force ? ['-f'] : []), containerId],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 50000,
      },
    );
    return !result.timedOut && result.exitCode === 0;
  }

  private async createContainer(options: DockerRunOptions): Promise<string> {
    const args = [
      'container',
      'create',
      '--name',
      options.containerName,
      '--network',
      options.networkName,
      ...(options.networkAlias
        ? ['--network-alias', options.networkAlias]
        : []),
      '--runtime',
      this.dockerRuntime,
      '--read-only',
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'ALL',
      '--tmpfs',
      '/tmp',
      ...this.toLabelArgs(options.labels),
      ...(options.cpus ? ['--cpus', options.cpus] : []),
      ...(options.memory ? ['--memory', options.memory] : []),
      ...this.toPortArgs(options.ports),
      options.imageTag,
      ...options.command,
    ];
    const result = await runCommand('docker', args, {
      timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
      maxBufferedChars: 250000,
    });
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `No se pudo crear el contenedor ${options.containerName}: ${this.normalizeError(result)}`,
      );
    }
    return result.stdout.trim();
  }

  private async startContainer(containerId: string): Promise<void> {
    const result = await runCommand(
      'docker',
      ['container', 'start', containerId],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo arrancar el contenedor ${containerId}: ${this.normalizeError(result)}`,
      );
    }
  }

  private async networkExists(networkName: string): Promise<boolean> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: DEFAULT_DOCKER_CHECK_TIMEOUT_MS,
        maxBufferedChars: 250000,
      },
    );
    return !result.timedOut && result.exitCode === 0;
  }

  private toLabelArgs(labels?: Record<string, string>): string[] {
    return Object.entries(labels ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, value]) => ['--label', `${key}=${value}`]);
  }

  private toPortArgs(
    ports?: DockerRunOptions['ports'],
  ): string[] {
    return (ports ?? []).flatMap((port) => {
      const protocol = port.protocol ?? 'tcp';
      const binding =
        typeof port.hostPort === 'number'
          ? `${port.hostPort}:${port.containerPort}/${protocol}`
          : `${port.containerPort}/${protocol}`;
      return ['-p', binding];
    });
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
