import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type {
  DockerHostAvailabilityOptions,
  DockerHostInfo,
} from './docker.types';
import { normalizeDockerCommandError } from './docker.utils';

@Injectable()
export class DockerHostService {
  async inspectDockerHost(options: {
    timeoutMs: number;
    maxBufferedChars?: number;
  }): Promise<DockerHostInfo> {
    const result = await runCommand(
      'docker',
      ['info', '--format', '{{json .}}'],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 50000,
      },
    );
    if (result.timedOut || result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ServiceUnavailableException(
        `Docker daemon no disponible: ${normalizeDockerCommandError(result)}`,
      );
    }

    return JSON.parse(result.stdout) as DockerHostInfo;
  }

  async assertDockerAvailable(
    options: DockerHostAvailabilityOptions,
  ): Promise<DockerHostInfo> {
    const dockerInfo = await this.inspectDockerHost(options);
    if (!dockerInfo.ServerVersion) {
      throw new ServiceUnavailableException(
        'Docker daemon no disponible: sin version de servidor.',
      );
    }
    if (
      options.nodeEnv === 'production' &&
      options.sandboxRuntime !== 'runsc'
    ) {
      throw new ServiceUnavailableException(
        `Sandbox runtime invalido para produccion: ${options.sandboxRuntime}.`,
      );
    }
    if (
      options.nodeEnv === 'production' &&
      options.sandboxRuntime === 'runsc' &&
      !dockerInfo.Runtimes?.runsc
    ) {
      throw new ServiceUnavailableException(
        'Docker daemon no disponible: runtime runsc no registrado.',
      );
    }

    return dockerInfo;
  }

  async tryVersion(
    command: string,
    args: string[],
    timeoutMs: number,
  ): Promise<string | null> {
    try {
      const result = await runCommand(command, args, { timeoutMs });
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
}
