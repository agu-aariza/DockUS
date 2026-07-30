/**
 * @fileoverview Recuperación de runs huérfanos tras reinicios.
 *
 * Contexto:
 * - Un run RUNNING sin progreso tras un reinicio está realmente huérfano: el
 *   proceso que lo ejecutaba ya no existe y nadie va a terminarlo.
 * - Un run QUEUED, en cambio, NO está huérfano por el mero hecho de llevar
 *   tiempo esperando: bajo carga, esperar en cola es el comportamiento normal.
 *   Solo lo está si la cola ya no tiene su job (ESC-C04).
 *
 * @module BuilderStaleRunRecoveryService
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import {
  BUILDER_JOB_PRIORITY,
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
} from '../../../domain/builder.constants';
import type { ExecuteBuildRunJobData } from '../builder-application.types';
import { PROCESS_ROLE } from '../../../../../../process-role.module';
import type { ProcessRole } from '../../../../../../process-role.module';

/** Tope de runs QUEUED que se reconcilian por pasada. */
const MAX_ORPHAN_CANDIDATES_PER_SWEEP = 200;

@Injectable()
export class BuilderStaleRunRecoveryService {
  private readonly logger = new Logger(BuilderStaleRunRecoveryService.name);

  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly builderConfigProvider: BuilderConfigProvider,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    @Inject(PROCESS_ROLE)
    private readonly processRole: ProcessRole,
  ) {}

  /**
   * Punto de entrada del arranque del worker. Conserva el nombre porque es el
   * que invoca `BuilderModule.onModuleInit`.
   */
  async failStaleRunsOnStartup(): Promise<void> {
    await this.recoverStaleRuns('startup');
  }

  /**
   * Barrido periódico. Un run puede quedar huérfano en cualquier momento —el
   * worker cae a mitad de una evaluación—, no solo durante un reinicio; hacerlo
   * únicamente al arrancar dejaba esos runs colgados hasta el siguiente
   * despliegue.
   *
   * Se restringe al proceso worker por el mismo motivo que el barrido de
   * arranque: la API no debe tocar runs que un worker está procesando.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStaleRunsPeriodically(): Promise<void> {
    if (this.processRole !== 'worker') {
      return;
    }
    await this.recoverStaleRuns('cron');
  }

  private async recoverStaleRuns(trigger: 'startup' | 'cron'): Promise<void> {
    const staleThresholdMs = this.builderConfigProvider.staleRunThresholdMs;
    const staleThresholdDate = new Date(Date.now() - staleThresholdMs);

    const failedRunning = await this.failStaleRunningRuns(staleThresholdDate);
    const queuedOutcome =
      await this.reconcileStaleQueuedRuns(staleThresholdDate);

    if (failedRunning || queuedOutcome.failed || queuedOutcome.requeued) {
      this.logger.warn(
        JSON.stringify({
          event: 'builder_stale_runs_recovered',
          trigger,
          runningFailed: failedRunning,
          queuedFailed: queuedOutcome.failed,
          queuedRequeued: queuedOutcome.requeued,
          staleThresholdMs,
        }),
      );
    }
  }

  /**
   * Un RUNNING sin progreso más allá del umbral no tiene quien lo termine.
   *
   * Se ejecuta como una única sentencia `UPDATE ... WHERE`, no leyendo-
   * modificando-escribiendo: con varios workers arrancando a la vez, un ciclo
   * lectura/escritura abre una carrera sobre las mismas filas. El filtro por
   * antigüedad es lo único que separa un run huérfano de uno que se está
   * procesando ahora mismo, de modo que el umbral debe ser mayor que el trabajo
   * más largo posible.
   */
  private async failStaleRunningRuns(
    staleThresholdDate: Date,
  ): Promise<number> {
    // Solo RUNNING. Incluir QUEUED destruía trabajo válido en cada reinicio:
    // bajo backlog, un run espera legítimamente más que el umbral y BullMQ
    // sigue teniendo su job, que se ejecutaría después contra un run ya
    // marcado FAILED dejando la entrega colgada en IN_REVIEW.
    return this.buildRunsRepository.failStaleRunning(staleThresholdDate);
  }

  /**
   * Para un QUEUED antiguo, la cola es la autoridad: si conserva su job, el run
   * está esperando y no debe tocarse. Si no lo conserva, el job se perdió y el
   * run nunca arrancará; en ese caso se reencola en lugar de fallarlo, porque
   * el trabajo sigue siendo válido y el alumno no ha hecho nada mal.
   *
   * ORC-006: la version anterior convertia cualquier error de `getJob()` en
   * "no existe" (`.catch(() => null)`), y si el job existia, hacia `continue`
   * sin consultar `getState()`. Eso confundia tres cosas distintas:
   *   - Redis no responde -> antes se trataba como "job perdido" y se podia
   *     marcar FAILED un run perfectamente sano por una caida transitoria.
   *   - El job existe pero ya esta 'completed'/'failed' en BullMQ (el
   *     handler nunca llego a reclamarlo, p.ej. broke antes del primer
   *     UPDATE) -> antes se dejaba QUEUED para siempre, colgando la entrega.
   *   - El job existe y sigue activo/en espera -> unico caso en el que no
   *     tocar nada es correcto.
   * Ahora se distinguen explicitamente: indeterminado (no se muta, se
   * reintenta en la siguiente pasada), terminal-sin-reconciliar (se falla,
   * como el caso de perdida real), y activo (se deja tal cual).
   */
  private async reconcileStaleQueuedRuns(
    staleThresholdDate: Date,
  ): Promise<{ failed: number; requeued: number }> {
    const candidates = await this.buildRunsRepository.findStaleQueued(
      staleThresholdDate,
      MAX_ORPHAN_CANDIDATES_PER_SWEEP,
    );

    let failed = 0;
    let requeued = 0;

    for (const run of candidates) {
      let job: Awaited<ReturnType<Queue['getJob']>>;
      try {
        job = await this.builderRunsQueue.getJob(run.id);
      } catch (error) {
        // Indeterminado: no sabemos si el job existe. Mutar aqui es
        // exactamente el bug de ORC-006 (falso FAILED por Redis caido); se
        // deja el candidato tal cual para la siguiente pasada del barrido.
        this.logger.warn(
          `No se pudo consultar el estado en cola del run ${run.id} huerfano candidato (se reintenta en la siguiente pasada): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      if (job) {
        const state = await job.getState().catch(() => 'unknown' as const);

        if (state === 'completed' || state === 'failed') {
          // BullMQ ya considera terminado este job (attempts:1, sin mas
          // reintentos posibles) pero el run sigue QUEUED en DB: el handler
          // nunca llego a reclamarlo. Dejarlo QUEUED para siempre colgaria
          // la entrega en revision indefinidamente.
          const failedNow = await this.buildRunsRepository.failIfStillQueued(
            run.id,
            `RUN_LOST_IN_QUEUE: el job de BullMQ ya esta '${state}' pero el run seguia QUEUED.`,
          );
          if (failedNow) failed += 1;
          continue;
        }

        // waiting/active/delayed/prioritized/waiting-children/unknown: sigue
        // en juego, o su estado es indeterminado pero el job existe — en
        // ambos casos, no mutar.
        continue;
      }

      // job === null: BullMQ confirma (sin lanzar) que no existe. Distinto
      // de la rama de error de arriba: aqui si es seguro actuar.
      try {
        await this.builderRunsQueue.add(
          BUILDER_RUN_JOB_NAME,
          {
            buildRunId: run.id,
            deliveryId: run.deliveryId,
          } satisfies ExecuteBuildRunJobData,
          {
            attempts: 1,
            removeOnComplete: 100,
            removeOnFail: 200,
            jobId: run.id,
            // Prioridad de lote (ESC-BAJO-02): un run huérfano se recupera,
            // pero no debe colarse por delante de una reejecución interactiva
            // que un docente esté esperando.
            priority: BUILDER_JOB_PRIORITY.BATCH,
          },
        );
        requeued += 1;
      } catch (error) {
        // Si tampoco se puede reencolar, dejarlo QUEUED para siempre es peor
        // que fallarlo: el alumno vería una entrega en revisión indefinida.
        this.logger.error(
          `No se pudo reencolar el run huerfano ${run.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await this.buildRunsRepository.failIfStillQueued(
          run.id,
          'RUN_LOST_IN_QUEUE: el trabajo no existe en la cola y no pudo reencolarse.',
        );
        failed += 1;
      }
    }

    return { failed, requeued };
  }
}
