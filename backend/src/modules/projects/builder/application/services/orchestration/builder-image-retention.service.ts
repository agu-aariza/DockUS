/**
 * @fileoverview Poda periódica de imágenes de entorno.
 *
 * Contexto:
 * - Cada configuración de dependencias distinta genera una imagen
 *   `dockus-env-<hash>`. Nada las eliminaba: el disco del anfitrión crecía de
 *   forma monótona y, al llenarse, **mueren todos los workers de esa máquina**,
 *   no solo el que provocó el llenado (ESC-CRIT-06).
 * - `BUILDER_CLEANUP_IMAGES` y `BUILDER_IMAGE_TTL_MS` ya estaban validadas y sin
 *   consumidor, de modo que la limpieza aparentaba estar activada por defecto
 *   cuando no existía.
 *
 * @module BuilderImageRetentionService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DockerImageService } from '../../../../../../shared/infrastructure/docker/docker-image.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { PROCESS_ROLE } from '../../../../../../process-role.module';
import type { ProcessRole } from '../../../../../../process-role.module';

const PRUNE_TIMEOUT_MS = 120_000;

@Injectable()
export class BuilderImageRetentionService {
  private readonly logger = new Logger(BuilderImageRetentionService.name);

  constructor(
    private readonly dockerImageService: DockerImageService,
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
      const deleted = await this.dockerImageService.pruneEnvironmentImages({
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
