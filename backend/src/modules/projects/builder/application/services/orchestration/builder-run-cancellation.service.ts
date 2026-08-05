/**
 * @fileoverview Cancelación cooperativa de un `BuildRun` en curso.
 *
 * Contexto:
 * - `cancelRun` en `BuilderRunCommandsService` sigue siendo la fuente de
 * verdad: un UPDATE condicionado en Postgres que nada aquí sustituye.
 * - Este servicio añade una vía rápida para que el pipeline, que no vuelve a
 * tocar la base de datos entre etapas, se entere sin re-consultarla cada
 * vez: una clave Redis con TTL que expira sola si algo queda huérfano.
 * - Si Redis no responde, se cae a Postgres (más lento, pero es la fuente de
 * verdad) en vez de tratar el error como "no cancelado": una cancelación
 * real nunca debe leerse como negativa solo porque Redis esté caído.
 *
 * @module BuilderRunCancellationService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import type { IDistributedCache } from '../../../domain/ports/distributed-cache.port';
import { DISTRIBUTED_CACHE } from '../../../domain/ports/distributed-cache.port';
import { RunCancelledError } from './run-cancelled.error';

/** Cubre con margen la duración máxima razonable de un run; expira sola. */
const CANCEL_KEY_TTL_SECONDS = 3600;

/**
 * Cadencia del sondeo en segundo plano durante el tramo largo (ejecución
 * Docker). Entre etapas basta un chequeo puntual porque cada etapa ya
 * devuelve el control; aquí no: un contenedor puede correr varios minutos
 * sin que nadie vuelva a preguntar si no es este intervalo.
 */
const CANCEL_POLL_INTERVAL_MS = 3000;

export interface CancellationWatcher {
  signal: AbortSignal;
  stop: () => void;
}

@Injectable()
export class BuilderRunCancellationService {
  private readonly logger = new Logger(BuilderRunCancellationService.name);

  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    @Inject(DISTRIBUTED_CACHE)
    private readonly distributedCache: IDistributedCache,
  ) {}

  /** Publica la señal de cancelación. `cancelRun` ya hizo el UPDATE atómico. */
  async markCancelled(runId: string): Promise<void> {
    try {
      await this.distributedCache.set(
        this.cancelKey(runId),
        '1',
        CANCEL_KEY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo publicar la cancelacion de ${runId} en Redis (se degrada a chequeo por BD): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async isCancelled(runId: string): Promise<boolean> {
    try {
      return await this.distributedCache.exists(this.cancelKey(runId));
    } catch {
      const run = await this.buildRunsRepository.findById(runId);
      return run?.status === BuildRunStatus.CANCELLED;
    }
  }

  async assertNotCancelled(runId: string): Promise<void> {
    if (await this.isCancelled(runId)) {
      throw new RunCancelledError(runId);
    }
  }

  /**
   * Abre un `AbortSignal` que se dispara en cuanto el sondeo detecta la
   * cancelación. Pensado para el tramo Docker: `execution-stage.handler.ts`
   * lo pasa a `runEphemeralContainer` para matar el contenedor en curso.
   * `stop()` debe llamarse siempre al terminar la etapa, con éxito o sin él.
   */
  createCancellationWatcher(runId: string): CancellationWatcher {
    const controller = new AbortController();
    const interval = setInterval(() => {
      this.isCancelled(runId)
        .then((cancelled) => {
          if (cancelled) {
            controller.abort();
          }
        })
        .catch(() => undefined);
    }, CANCEL_POLL_INTERVAL_MS);
    interval.unref?.();

    return {
      signal: controller.signal,
      stop: () => clearInterval(interval),
    };
  }

  private cancelKey(runId: string): string {
    return `builder:cancel:${runId}`;
  }
}
