/**
 * @fileoverview Recuperación de runs huérfanos tras reinicios.
 *
 * Contexto:
 * - Al reiniciar el worker, los runs que quedaron en QUEUED o RUNNING sin
 *   finalizar se marcan como FAILED para evitar que permanezcan bloqueados.
 *
 * @module BuilderStaleRunRecoveryService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';

@Injectable()
export class BuilderStaleRunRecoveryService {
  private readonly logger = new Logger(BuilderStaleRunRecoveryService.name);

  constructor(
    @Inject('IBuildRunRepository')
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly builderConfigProvider: BuilderConfigProvider,
  ) {}

  /**
   * Marca como FAILED los runs que quedaron activos tras un reinicio.
   *
   * Se ejecuta en una única sentencia `UPDATE ... WHERE`, no leyendo-modificando-
   * escribiendo: con varios procesos arrancando a la vez (o varios workers), un
   * ciclo lectura/escritura abre una carrera sobre las mismas filas. El filtro
   * por antigüedad es lo único que separa un run realmente huérfano de uno que
   * un worker está procesando ahora mismo, de modo que el umbral debe ser mayor
   * que el trabajo más largo posible; por eso, además, este barrido solo debe
   * dispararlo el worker (véase el arranque en `worker.ts`).
   */
  async failStaleRunsOnStartup(): Promise<void> {
    const staleThresholdMs = this.builderConfigProvider.staleRunThresholdMs;
    const staleThresholdDate = new Date(Date.now() - staleThresholdMs);

    const result = await this.buildRunsRepository
      .createQueryBuilder('run')
      .update()
      .set({
        status: BuildRunStatus.FAILED,
        finishedAt: () => 'NOW()',
        failureReason:
          'RUN_STALE_AFTER_RESTART: la ejecucion quedo huerfana tras reinicio.',
      })
      .where('"status" IN (:...statuses)', {
        statuses: [BuildRunStatus.QUEUED, BuildRunStatus.RUNNING],
      })
      .andWhere('"updatedAt" < :staleThresholdDate', {
        staleThresholdDate: staleThresholdDate.toISOString(),
      })
      .execute();

    if (result.affected) {
      this.logger.warn(
        JSON.stringify({
          event: 'builder_stale_runs_failed',
          affected: result.affected,
          staleThresholdMs,
        }),
      );
    }
  }
}
