/**
 * @fileoverview Servicio de poda y retención periódica de imágenes de contenedor efímeras.
 *
 * @description
 * Realiza la poda programada (cron cada 30 min) de las imágenes de Docker generadas
 * para las evaluaciones (`dockus-env-<hash>`) según el TTL configurado, evitando el agotamiento del disco host.
 *
 * @module BuilderImageRetentionService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import type { IContainerRuntime } from '../../../domain/ports/container-runtime.port';
import { CONTAINER_RUNTIME } from '../../../domain/ports/container-runtime.port';
import { PROCESS_ROLE } from '../../../../../../process-role.module';
import type { ProcessRole } from '../../../../../../process-role.module';

const PRUNE_TIMEOUT_MS = 120_000;

@Injectable()
export class BuilderImageRetentionService {
  private readonly logger = new Logger(BuilderImageRetentionService.name);

  constructor(
    @Inject(CONTAINER_RUNTIME)
    private readonly containerRuntime: IContainerRuntime,
    private readonly builderConfigProvider: BuilderConfigProvider,
    @Inject(PROCESS_ROLE)
    private readonly processRole: ProcessRole,
  ) {}

  /**
   * Solo lo dispara el worker, por el mismo motivo que el barrido de runs
   * huérfanos: es el proceso que convive con el demonio de contenedores y el
   * único que sabe qué imágenes están realmente en uso. Si la API lo ejecutase
   * apuntando a otro demonio, podaría un inventario que no le corresponde.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async pruneStaleEnvironmentImages(): Promise<void> {
    if (this.processRole !== 'worker') {
      return;
    }

    if (!this.builderConfigProvider.cleanupImages) {
      return;
    }

    const olderThanHours = this.builderConfigProvider.imageTtlMs / 3_600_000;

    try {
      const deleted = await this.containerRuntime.pruneEnvironmentImages({
        olderThanHours,
        timeoutMs: PRUNE_TIMEOUT_MS,
      });

      if (deleted > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'builder_environment_images_pruned',
            deleted,
            olderThanHours,
          }),
        );
      }
    } catch (error) {
      // Un fallo de poda no debe tumbar el worker: degrada a "el disco sigue
      // creciendo", que es el estado previo, y queda registrado para que sea
      // visible antes de que el disco se llene.
      this.logger.error(
        `No se pudo podar las imagenes de entorno: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
