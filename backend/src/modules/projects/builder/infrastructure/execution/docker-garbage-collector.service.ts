import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCommand } from '../utils/command-runner.util';

type DockerPsRow = {
  ID?: string;
  State?: string;
};

type DockerNetworkRow = {
  Name?: string;
};

@Injectable()
export class DockerGarbageCollectorService {
  private readonly logger = new Logger(DockerGarbageCollectorService.name);

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleManagedResourceCleanup(): Promise<void> {
    await this.pruneManagedResources();
  }

  async pruneManagedResources(): Promise<void> {
    await this.removeStoppedManagedContainers();
    await this.removeEmptyManagedRunNetworks();
  }

  private async removeStoppedManagedContainers(): Promise<void> {
    const containers = await this.listManagedContainers();
    for (const container of containers) {
      const containerId =
        typeof container.ID === 'string' ? container.ID.trim() : '';
      const state =
        typeof container.State === 'string'
          ? container.State.trim().toLowerCase()
          : '';

      if (!containerId || state === 'running') {
        continue;
      }

      const result = await runCommand(
        'docker',
        ['container', 'rm', '-f', containerId],
        {
          timeoutMs: 15000,
          maxBufferedChars: 50000,
        },
      );
      if (result.timedOut || result.exitCode !== 0) {
        this.logger.warn(
          `No se pudo eliminar el contenedor gestionado ${containerId}: ${this.normalizeError(result)}`,
        );
      }
    }
  }

  private async removeEmptyManagedRunNetworks(): Promise<void> {
    const networks = await this.listManagedNetworks();
    for (const network of networks) {
      const networkName =
        typeof network.Name === "string" ? network.Name.trim() : '';
      if (!networkName || !networkName.startsWith('dockus-run-')) {
        continue;
      }

      const inspectResult = await runCommand(
        'docker',
        ['network', 'inspect', networkName],
        {
          timeoutMs: 15000,
          maxBufferedChars: 250000,
        },
      );
      if (inspectResult.timedOut || inspectResult.exitCode !== 0) {
        this.logger.warn(
          `No se pudo inspeccionar la red ${networkName}: ${this.normalizeError(inspectResult)}`,
        );
        continue;
      }

      const inspectPayload = JSON.parse(inspectResult.stdout || '[]') as Array<{
        Containers?: Record<string, unknown>;
      }>;
      const containerCount = Object.keys(
        inspectPayload[0]?.Containers ?? {},
      ).length;
      if (containerCount > 0) {
        continue;
      }

      const removeResult = await runCommand(
        'docker',
        ['network', 'rm', networkName],
        {
          timeoutMs: 15000,
          maxBufferedChars: 50000,
        },
      );
      if (removeResult.timedOut || removeResult.exitCode !== 0) {
        this.logger.warn(
          `No se pudo eliminar la red gestionada ${networkName}: ${this.normalizeError(removeResult)}`,
        );
      }
    }
  }

  private async listManagedContainers(): Promise<DockerPsRow[]> {
    const result = await runCommand(
      'docker',
      [
        'container',
        'ls',
        '-a',
        '--filter',
        'label=dockus.managed=true',
        '--format',
        '{{json .}}',
      ],
      {
        timeoutMs: 15000,
        maxBufferedChars: 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      this.logger.warn(
        `No se pudieron listar contenedores Docker gestionados: ${this.normalizeError(result)}`,
      );
      return [];
    }

    return this.parseJsonLines<DockerPsRow>(result.stdout);
  }

  private async listManagedNetworks(): Promise<DockerNetworkRow[]> {
    const result = await runCommand(
      'docker',
      [
        'network',
        'ls',
        '--filter',
        'label=dockus.managed=true',
        '--format',
        '{{json .}}',
      ],
      {
        timeoutMs: 15000,
        maxBufferedChars: 500000,
      },
    );
    if (result.timedOut || result.exitCode !== 0) {
      this.logger.warn(
        `No se pudieron listar redes Docker gestionadas: ${this.normalizeError(result)}`,
      );
      return [];
    }

    return this.parseJsonLines<DockerNetworkRow>(result.stdout);
  }

  private parseJsonLines<T>(raw: string): T[] {
    return raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  private normalizeError(result: {
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }): string {
    if (result.timedOut) {
      return 'timeout';
    }
    return result.stderr.trim() || result.stdout.trim() || `exitCode=${result.exitCode}`;
  }
}
