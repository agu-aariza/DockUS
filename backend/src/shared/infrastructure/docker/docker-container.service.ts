import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type {
  DockerContainerRunOptions,
  DockerListOptions,
  DockerRemoveOptions,
  DockerWaitOptions,
} from './docker.types';
import {
  buildDockerFilterArgs,
  buildDockerLabelArgs,
  isMissingDockerResource,
  normalizeDockerCommandError,
  parseDockerJsonArray,
  parseDockerJsonLines,
} from './docker.utils';

@Injectable()
export class DockerContainerService {
  async runContainer(options: DockerContainerRunOptions): Promise<string> {
    const containerId = await this.createContainer(options);
    await this.startContainer(containerId, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars,
    });
    return containerId;
  }

  async runEphemeralContainer(
    options: DockerContainerRunOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const networkArgs =
      options.networkMode === 'none'
        ? ['--network', 'none']
        : options.networkName
          ? ['--network', options.networkName]
          : [];

    const bindArgs = (options.binds ?? []).flatMap((bind) => ['-v', bind]);
    const workdirArgs = options.workingDir ? ['-w', options.workingDir] : [];
    const environmentArgs = Object.entries(options.environment ?? {}).flatMap(
      ([key, value]) => ['-e', `${key}=${value}`],
    );

    const args = [
      'container',
      'run',
      '--rm',
      '--name',
      options.containerName,
      ...networkArgs,
      ...(options.networkAlias
        ? ['--network-alias', options.networkAlias]
        : []),
      '--runtime',
      options.runtime,
      '--security-opt',
      'no-new-privileges',
      '--tmpfs',
      '/tmp',
      ...buildDockerLabelArgs(options.labels),
      ...(options.cpus ? ['--cpus', options.cpus] : []),
      ...(options.memory ? ['--memory', options.memory] : []),
      ...this.toPortArgs(options.ports),
      ...bindArgs,
      ...workdirArgs,
      ...environmentArgs,
      options.imageTag,
      ...options.command,
    ];

    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 1_500_000,
      onStdoutChunk: options.onStdoutChunk,
      onStderrChunk: options.onStderrChunk,
    });

    if (result.timedOut) {
      // Forzar la eliminación del contenedor en el daemon. Matar el proceso
      // CLI de docker no garantiza que el daemon detenga el contenedor
      // inmediatamente, especialmente bajo carga o con bucles infinitos.
      await this.removeContainer(options.containerName, {
        force: true,
        timeoutMs: 5_000,
      }).catch(() => undefined);

      return {
        exitCode: -1,
        stdout: result.stdout,
        stderr:
          `${result.stderr}\n[TIMEOUT] La ejecucion supero el limite de tiempo y fue cancelada.`.trim(),
      };
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async runDaemonContainer(
    options: DockerContainerRunOptions,
  ): Promise<string> {
    return this.runContainer(options);
  }

  async waitContainer(
    containerId: string,
    options: DockerWaitOptions,
  ): Promise<{ StatusCode: number; TimedOut?: boolean }> {
    const result = await runCommand(
      'docker',
      ['container', 'wait', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    if (result.timedOut) {
      return { StatusCode: -1, TimedOut: true };
    }
    if (result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo esperar al contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }

    return {
      StatusCode: Number.parseInt(result.stdout.trim(), 10) || 0,
    };
  }

  async getContainerLogs(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<string> {
    const result = await runCommand(
      'docker',
      ['container', 'logs', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 1_500_000,
      },
    );
    return `${result.stdout}\n${result.stderr}`.trim();
  }

  async inspectContainer<T extends Record<string, unknown>>(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<T | null> {
    const result = await runCommand(
      'docker',
      ['container', 'inspect', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 500000,
      },
    );
    if (isMissingDockerResource(result, /No such container|not found/iu)) {
      return null;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar el contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }
    const payload = parseDockerJsonArray<T>(result.stdout);
    return payload[0] ?? null;
  }

  async removeContainer(
    containerId: string,
    options: DockerRemoveOptions,
  ): Promise<boolean> {
    const result = await runCommand(
      'docker',
      [
        'container',
        'rm',
        ...(options.force === false ? [] : ['-f']),
        containerId,
      ],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    return !result.timedOut && result.exitCode === 0;
  }

  async listContainers<T extends Record<string, unknown>>(
    options: DockerListOptions & { all?: boolean },
  ): Promise<T[]> {
    const result = await runCommand(
      'docker',
      [
        'container',
        'ls',
        ...(options.all ? ['-a'] : []),
        ...buildDockerFilterArgs(options.labels),
        '--format',
        '{{json .}}',
      ],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudieron listar contenedores Docker: ${normalizeDockerCommandError(result)}`,
      );
    }

    return parseDockerJsonLines<T>(result.stdout);
  }

  private async createContainer(
    options: DockerContainerRunOptions,
  ): Promise<string> {
    const networkArgs =
      options.networkMode === 'none'
        ? ['--network', 'none']
        : options.networkName
          ? ['--network', options.networkName]
          : [];
    const bindArgs = (options.binds ?? []).flatMap((bind) => ['-v', bind]);
    const workdirArgs = options.workingDir ? ['-w', options.workingDir] : [];
    const environmentArgs = Object.entries(options.environment ?? {}).flatMap(
      ([key, value]) => ['-e', `${key}=${value}`],
    );
    const args = [
      'container',
      'create',
      '--name',
      options.containerName,
      ...networkArgs,
      ...(options.networkAlias
        ? ['--network-alias', options.networkAlias]
        : []),
      '--runtime',
      options.runtime,
      '--read-only',
      '--security-opt',
      'no-new-privileges',
      '--cap-drop',
      'ALL',
      '--tmpfs',
      '/tmp',
      ...buildDockerLabelArgs(options.labels),
      ...(options.cpus ? ['--cpus', options.cpus] : []),
      ...(options.memory ? ['--memory', options.memory] : []),
      ...this.toPortArgs(options.ports),
      ...bindArgs,
      ...workdirArgs,
      ...environmentArgs,
      options.imageTag,
      ...options.command,
    ];
    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 250000,
    });
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `No se pudo crear el contenedor ${options.containerName}: ${normalizeDockerCommandError(result)}`,
      );
    }
    return result.stdout.trim();
  }

  private async startContainer(
    containerId: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<void> {
    const result = await runCommand(
      'docker',
      ['container', 'start', containerId],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo arrancar el contenedor ${containerId}: ${normalizeDockerCommandError(result)}`,
      );
    }
  }

  private toPortArgs(
    ports?: Array<{
      containerPort: number;
      hostPort?: number;
      protocol?: 'tcp' | 'udp';
    }>,
  ): string[] {
    return (ports ?? []).flatMap(({ containerPort, hostPort, protocol }) => [
      '-p',
      `${hostPort ? `${hostPort}:` : ''}${containerPort}/${protocol ?? 'tcp'}`,
    ]);
  }
}
