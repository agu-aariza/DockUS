import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { DockerContainerService } from '../../../../../shared/infrastructure/docker/docker-container.service';
import { DockerImageService } from '../../../../../shared/infrastructure/docker/docker-image.service';
import { DockerNetworkService } from '../../../../../shared/infrastructure/docker/docker-network.service';
import { BuildRun } from '../../domain/entities/build-run.entity';

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
  private readonly cleanupImages: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly dockerContainerService: DockerContainerService,
    private readonly dockerNetworkService: DockerNetworkService,
    private readonly dockerImageService: DockerImageService,
  ) {
    this.cleanupImages =
      this.configService.get<boolean>('BUILDER_CLEANUP_IMAGES', true) ?? true;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleManagedResourceCleanup(): Promise<void> {
    await this.pruneManagedResources();
  }

  async pruneManagedResources(): Promise<void> {
    await this.removeStoppedManagedContainers();
    await this.removeEmptyManagedRunNetworks();
    await this.removeExpiredManagedImages();
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

      const removed = await this.dockerContainerService.removeContainer(
        containerId,
        {
          timeoutMs: 15000,
          maxBufferedChars: 50000,
        },
      );
      if (!removed) {
        this.logger.warn(
          `No se pudo eliminar el contenedor gestionado ${containerId}.`,
        );
      }
    }
  }

  private async removeEmptyManagedRunNetworks(): Promise<void> {
    const networks = await this.listManagedNetworks();
    for (const network of networks) {
      const networkName =
        typeof network.Name === 'string' ? network.Name.trim() : '';
      if (!networkName || !networkName.startsWith('dockus-run-')) {
        continue;
      }

      let inspectPayload: { Containers?: Record<string, unknown> } | null =
        null;
      try {
        inspectPayload = await this.dockerNetworkService.inspectNetwork<{
          Containers?: Record<string, unknown>;
        }>(networkName, {
          timeoutMs: 15000,
          maxBufferedChars: 250000,
        });
      } catch (error) {
        this.logger.warn(
          `No se pudo inspeccionar la red ${networkName}: ${this.toErrorMessage(error)}`,
        );
        continue;
      }

      const containerCount = Object.keys(
        inspectPayload?.Containers ?? {},
      ).length;
      if (containerCount > 0) {
        continue;
      }

      const removed = await this.dockerNetworkService.removeNetwork(
        networkName,
        {
          timeoutMs: 15000,
          maxBufferedChars: 50000,
        },
      );
      if (!removed) {
        this.logger.warn(
          `No se pudo eliminar la red gestionada ${networkName}.`,
        );
      }
    }
  }

  private async listManagedContainers(): Promise<DockerPsRow[]> {
    try {
      return await this.dockerContainerService.listContainers<DockerPsRow>({
        all: true,
        labels: { 'dockus.managed': 'true' },
        timeoutMs: 15000,
        maxBufferedChars: 500000,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudieron listar contenedores Docker gestionados: ${this.toErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async listManagedNetworks(): Promise<DockerNetworkRow[]> {
    try {
      return await this.dockerNetworkService.listNetworks<DockerNetworkRow>({
        labels: { 'dockus.managed': 'true' },
        timeoutMs: 15000,
        maxBufferedChars: 500000,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudieron listar redes Docker gestionadas: ${this.toErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async removeExpiredManagedImages(): Promise<void> {
    if (!this.cleanupImages) {
      return;
    }

    const expiredRuns = await this.buildRunsRepository.find({
      where: {
        imageTag: Not(IsNull()),
        imageExpiresAt: LessThanOrEqual(new Date()),
      },
    });

    for (const run of expiredRuns) {
      if (!run.imageTag) {
        continue;
      }

      const removed = await this.dockerImageService.removeImage(run.imageTag, {
        timeoutMs: 15000,
        maxBufferedChars: 50000,
      });
      if (!removed) {
        this.logger.warn(
          `No se pudo eliminar la imagen gestionada ${run.imageTag}.`,
        );
        continue;
      }

      run.imageTag = null;
      run.imageExpiresAt = null;
      await this.buildRunsRepository.save(run);
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'sin detalle';
  }
}
