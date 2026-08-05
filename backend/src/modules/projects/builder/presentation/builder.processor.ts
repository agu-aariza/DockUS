/**
 * @fileoverview Processor BullMQ para ejecución asíncrona de Builder.
 *
 * Contexto:
 * - Consume jobs de la cola builder-runs.
 * - Delega la ejecución y persistencia de estado al BuilderRunCommandsService.
 *
 * @module BuilderProcessor
 */

import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
  DEFAULT_STALE_RUN_THRESHOLD_MS,
} from '../domain/builder.constants';
import { BuilderRunLifecycleService } from '../application/services/orchestration/builder-run-lifecycle.service';
import type { ExecuteBuildRunJobData } from '../application/services/builder-application.types';

/** Valor por defecto histórico, conservado para no cambiar el comportamiento. */
const DEFAULT_WORKER_CONCURRENCY = 5;
const MIN_WORKER_CONCURRENCY = 1;
/**
 * Techo defensivo. Cada unidad de concurrencia es un contenedor con su propio
 * límite de memoria y un espacio de trabajo en `tmpfs`: un valor desmedido no
 * agota la cola sino la RAM del anfitrión, y el OOM se lleva al worker entero
 * en vez de a un contenedor.
 */
const MAX_WORKER_CONCURRENCY = 64;

/**
 * El decorador `@Processor` se evalúa al importar la clase, antes de que exista
 * el contenedor de DI, de modo que aquí no hay `ConfigService` disponible. Se
 * lee `process.env` directamente: es la única vía para hacer configurable un
 * valor consumido en tiempo de decoración. Un valor ausente o inválido cae al
 * valor por defecto en lugar de romper el arranque del worker.
 */
export function resolveWorkerConcurrency(): number {
  const raw = process.env.BUILDER_WORKER_CONCURRENCY;
  if (!raw) {
    return DEFAULT_WORKER_CONCURRENCY;
  }

  // `Number` y no `parseInt`: este último trunca en silencio, de modo que
  // "2.5" pasaría como 2 y "3 workers" como 3 en vez de detectarse como
  // configuración errónea.
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_WORKER_CONCURRENCY) {
    return DEFAULT_WORKER_CONCURRENCY;
  }

  return Math.min(parsed, MAX_WORKER_CONCURRENCY);
}

/**
 * Umbral de detección de runs huérfanos, leído del entorno.
 *
 * Debe coincidir con lo que `BuilderConfigProvider.staleRunThresholdMs` resuelve
 * vía `ConfigService`. El decorador `@Processor` se evalúa al importar la clase,
 * antes de que exista el contenedor de DI; por eso `lockDuration` debe leer
 * directamente el mismo valor de entorno que usa el barrido de runs huérfanos.
 *
 * Se lee `process.env` directamente por el mismo motivo que en
 * `resolveWorkerConcurrency`: es la única vía para un valor consumido en tiempo
 * de decoración. Un valor ausente o inválido cae al de siempre en lugar de
 * romper el arranque del worker.
 */
export function resolveStaleRunThresholdMs(): number {
  const raw = process.env.BUILDER_STALE_RUN_THRESHOLD_MS;
  if (!raw) {
    return DEFAULT_STALE_RUN_THRESHOLD_MS;
  }

  const parsed = Number(raw);
  // Por debajo de un minuto el cerrojo vencería en mitad de casi cualquier
  // evaluación real, que es exactamente el reencolado duplicado que se evita.
  if (!Number.isInteger(parsed) || parsed < 60_000) {
    return DEFAULT_STALE_RUN_THRESHOLD_MS;
  }

  return parsed;
}

// `lockDuration` alineado con el umbral de detección de runs huérfanos: con el
// valor por defecto de BullMQ (30 s), cualquier corte de Redis o el OOM del
// worker bajo concurrencia de Docker marca el job como "stalled" y lo reencola
// mientras el run original sigue vivo, duplicando ejecución de Docker y
// llamadas al LLM facturadas para el mismo BuildRun.
//
// maxStalledCount: 0 desactiva el reencolado automático: un job "stalled" se
// marca FAILED en vez de reprocesarse en silencio; la recuperación real de
// runs huérfanos queda en BuilderStaleRunRecoveryService (a nivel de BD).
@Processor(BUILDER_RUNS_QUEUE_NAME, {
  concurrency: resolveWorkerConcurrency(),
  lockDuration: resolveStaleRunThresholdMs(),
  maxStalledCount: 0,
})
export class BuilderProcessor extends WorkerHost {
  private readonly logger = new Logger(BuilderProcessor.name);

  constructor(
    private readonly builderRunLifecycleService: BuilderRunLifecycleService,
  ) {
    super();
  }

  async process(job: Job<ExecuteBuildRunJobData>): Promise<void> {
    if (job.name !== BUILDER_RUN_JOB_NAME) {
      return;
    }

    // Frontera entre procesos: aquí es donde el identificador de correlación
    // emitido por la API vuelve a aparecer, ya en los registros del worker. Es
    // el único punto en el que ambos lados quedan enlazados de forma explícita,
    // así que se registra tanto al empezar como al terminar —con éxito o sin
    // él— para poder acotar en el tiempo lo ocurrido en medio.
    const context = {
      buildRunId: job.data.buildRunId,
      deliveryId: job.data.deliveryId,
      correlationId: job.data.correlationId ?? null,
    };
    const startedAt = Date.now();

    this.logger.log(
      JSON.stringify({ event: 'builder_run_job_started', ...context }),
    );

    try {
      await this.builderRunLifecycleService.processBuildRunJob(job.data);
      this.logger.log(
        JSON.stringify({
          event: 'builder_run_job_finished',
          ...context,
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'builder_run_job_failed',
          ...context,
          durationMs: Date.now() - startedAt,
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
      // Se propaga: BuilderRunLifecycleService.processBuildRunJob ya marco el
      // run FAILED en su propio catch (o, si fue RunCancelledError, no hizo
      // nada porque cancelRun ya lo dejo CANCELLED). Este catch solo registra
      // el fallo a nivel de job de BullMQ.
      throw error;
    }
  }
}
