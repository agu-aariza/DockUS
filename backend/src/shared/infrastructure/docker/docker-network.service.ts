/**
 * @fileoverview Orquestación de contenedores y sandbox Docker (docker-network.service).
 *
 * @module docker-network.service
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { runCommand } from './command-runner.util';
import type {
  DockerCreateNetworkOptions,
  DockerListOptions,
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
export class DockerNetworkService {
  async createNetwork(
    networkName: string,
    options: DockerCreateNetworkOptions,
  ): Promise<void> {
    if (
      await this.networkExists(networkName, {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars,
      })
    ) {
      return;
    }

    const args = [
      'network',
      'create',
      ...(options.internal ? ['--internal'] : []),
      ...buildDockerLabelArgs(options.labels),
      networkName,
    ];
    const result = await runCommand('docker', args, {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 50000,
    });
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo crear la red ${networkName}: ${normalizeDockerCommandError(result)}`,
      );
    }
  }

  async removeNetwork(
    networkName: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<boolean> {
    const result = await runCommand('docker', ['network', 'rm', networkName], {
      timeoutMs: options.timeoutMs,
      maxBufferedChars: options.maxBufferedChars ?? 50000,
    });
    return !result.timedOut && result.exitCode === 0;
  }

  async inspectNetwork<T extends Record<string, unknown>>(
    networkName: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<T | null> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 500000,
      },
    );
    if (isMissingDockerResource(result, /No such network|not found/iu)) {
      return null;
    }
    if (result.timedOut || result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la red ${networkName}: ${normalizeDockerCommandError(result)}`,
      );
    }

    const payload = parseDockerJsonArray<T>(result.stdout);
    return payload[0] ?? null;
  }

  async networkExists(
    networkName: string,
    options: { timeoutMs: number; maxBufferedChars?: number },
  ): Promise<boolean> {
    const result = await runCommand(
      'docker',
      ['network', 'inspect', networkName],
      {
        timeoutMs: options.timeoutMs,
        maxBufferedChars: options.maxBufferedChars ?? 250000,
      },
    );
    if (!result.timedOut && result.exitCode === 0) {
      return true;
    }
    if (isMissingDockerResource(result, /No such network|not found/iu)) {
      return false;
    }
    if (result.timedOut) {
      throw new ServiceUnavailableException(
        `Timeout inspeccionando la red ${networkName}.`,
      );
    }
    if (result.exitCode !== 0) {
      throw new ServiceUnavailableException(
        `No se pudo inspeccionar la red ${networkName}: ${normalizeDockerCommandError(result)}`,
      );
    }
    return false;
  }

  async listNetworks<T extends Record<string, unknown> = { Name?: string }>(
    options: DockerListOptions,
  ): Promise<T[]> {
    const result = await runCommand(
      'docker',
      [
        'network',
        'ls',
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
        `No se pudieron listar redes Docker: ${normalizeDockerCommandError(result)}`,
      );
    }

    return parseDockerJsonLines<T>(result.stdout);
  }
}
