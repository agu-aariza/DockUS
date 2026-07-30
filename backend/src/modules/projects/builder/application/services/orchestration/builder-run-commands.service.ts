/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-run-commands.service).
 *
 * @module builder-run-commands.service
 */

import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';

import { JobsOptions, Queue } from 'bullmq';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';

import { throwIfUniqueViolation } from '../../../../../../shared/database/unique-violation.util';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import {
  BUILDER_JOB_PRIORITY,
  BUILDER_RUN_JOB_NAME,
  BUILDER_RUNS_QUEUE_NAME,
} from '../../../domain/builder.constants';
import { UserRole } from '../../../../../users/entities/user.entity';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import { BuilderAccessService } from '../workspace/builder-access.service';
import {
  EnqueueBuildRunResponse,
  ExecuteBuildRunJobData,
} from '../builder-application.types';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { BuilderRunCancellationService } from './builder-run-cancellation.service';
import { BuilderSpendQuotaService } from './builder-spend-quota.service';

@Injectable()
export class BuilderRunCommandsService {
  private readonly logger = new Logger(BuilderRunCommandsService.name);
  private readonly promptVersion: string;

  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    @InjectQueue(BUILDER_RUNS_QUEUE_NAME)
    private readonly builderRunsQueue: Queue,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunQueriesService: BuilderRunQueriesService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderConfigProvider: BuilderConfigProvider,
    private readonly builderRunCancellationService: BuilderRunCancellationService,
    private readonly builderSpendQuotaService: BuilderSpendQuotaService,
  ) {
    this.promptVersion = this.builderConfigProvider.promptVersion;
  }

  /**
   * @param correlationId Identificador de la petición HTTP que origina el run.
   *   Viaja en la carga útil del trabajo para que los registros de la API y los
   *   del worker —dos procesos distintos— puedan enlazarse. Es opcional porque
   *   no todo encolado nace de una petición: el reencolado de un run huérfano
   *   lo dispara una tarea programada.
   */
  async enqueueDeliveryRun(
    deliveryId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<EnqueueBuildRunResponse> {
    const delivery =
      await this.builderAccessService.findDeliveryOrThrow(deliveryId);
    await this.builderAccessService.assertCanTriggerDelivery(delivery, actor);

    // Cuota de gasto (ESC-ALTO-02). Se comprueba aquí y no dentro del pipeline
    // porque este es el único punto donde negarse ahorra dinero: una vez
    // lanzado el run, sus llamadas de inferencia ya están comprometidas y
    // abortarlo a mitad gastaría igual dejando además al alumno sin evaluar.
    await this.builderSpendQuotaService.assertProjectWithinQuota(
      delivery.assignment.projectId,
    );

    // ESC-MED-03. El encolado a Redis estaba DENTRO de la transacción, lo que
    // tenía dos costes: retenía una conexión del pool —recurso escaso— durante
    // una llamada de red ajena a la base de datos, y acoplaba dos sistemas que
    // no comparten transacción, de modo que un `COMMIT` fallido tras un
    // encolado correcto dejaba un job apuntando a una fila revertida.
    //
    // Ahora se confirma primero y se encola después. La ventana que eso abre
    // —run `QUEUED` sin job— es exactamente el caso que
    // `BuilderStaleRunRecoveryService.reconcileStaleQueuedRuns` reconcilia, y
    // que la fase 4 (T4.3) verificó contra infraestructura real: diez runs
    // huérfanos reencolados, ninguno perdido. La red de seguridad ya existía;
    // lo que faltaba era dejar de pagar por no usarla.
    let savedRun: BuildRun;
    try {
      savedRun = await this.buildRunsRepository.createQueuedRun({
        deliveryId,
        triggeredById: actor.userId,
        promptVersion: this.promptVersion,
      });
    } catch (error) {
      throwIfUniqueViolation(
        error,
        'Ya existe una ejecucion activa para esta entrega.',
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar la ejecucion de builder.',
      );
    }

    try {
      await this.enqueueRunJob(savedRun.id, delivery.id, actor, correlationId);
    } catch (error) {
      // Camino rápido: si el encolado falla y el proceso sigue vivo, se marca
      // FAILED de inmediato en lugar de esperar al barrido. El reconciliador
      // queda para lo que este `catch` no puede cubrir: que el proceso muera
      // entre el commit y el encolado.
      await this.builderRunSupportService
        .markRunAsFailed(
          savedRun.id,
          this.builderRunSupportService.toErrorMessage(error),
        )
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        'No se pudo encolar la ejecucion de builder.',
      );
    }

    const finalRun = savedRun;

    await this.builderRunSupportService.emitEvent({
      buildRunId: finalRun.id,
      eventType: 'RUN_ENQUEUED',
      runStatus: BuildRunStatus.QUEUED,
      message: 'Run estandar encolado.',
      payload: { deliveryId: delivery.id },
    });

    return {
      buildRunId: finalRun.id,
      status: BuildRunStatus.QUEUED,
      deliveryId: delivery.id,
    };
  }

  async cancelRun(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buildRunId: string; status: BuildRunStatus }> {
    const run = await this.builderRunQueriesService.getRunById(
      buildRunId,
      actor,
    );
    await this.builderAccessService.assertCanManageBuildRun(run, actor);

    if (
      run.status !== BuildRunStatus.QUEUED &&
      run.status !== BuildRunStatus.RUNNING
    ) {
      throw new ConflictException(
        `El run no se puede cancelar en estado ${run.status}.`,
      );
    }

    // UPDATE condicionado al estado, no lectura-modificacion-escritura: el
    // worker puede estar terminando (o fallando) este mismo run en paralelo.
    // Sigue siendo mas barato que un save() de la entidad completa (ARQ-013),
    // pero incrementa "version" igualmente (dentro de cancelIfActive): es lo
    // que hace que un save() en vuelo en BuilderRunLifecycleService detecte,
    // via lock optimista, que este UPDATE gano la carrera en vez de pisarlo
    // en silencio.
    const cancelled = await this.buildRunsRepository.cancelIfActive(buildRunId);

    if (!cancelled) {
      throw new ConflictException('El run finalizo antes de poder cancelarse.');
    }

    // El UPDATE de arriba ya es la fuente de verdad; esto (ARQ-004) es lo que
    // permite que el pipeline en curso se entere sin volver a consultar
    // Postgres entre etapas. Si Redis falla, el chequeo de resguardo del
    // servicio cae a BD, así que no perder este publish no es fatal.
    await this.builderRunCancellationService.markCancelled(buildRunId);

    if (run.status === BuildRunStatus.QUEUED) {
      // Oportunista: si el job ya lo tomo un worker, `remove` no hace nada y
      // la parada cooperativa (chequeo entre etapas + AbortSignal en la
      // etapa de ejecucion) es quien la corta.
      await this.builderRunsQueue.remove(buildRunId).catch((error: unknown) => {
        this.logger.warn(
          `No se pudo retirar de la cola el job ${buildRunId} tras cancelarlo: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    return { buildRunId, status: BuildRunStatus.CANCELLED };
  }

  private async enqueueRunJob(
    buildRunId: string,
    deliveryId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    // No hay timeout a nivel de job: BullMQ v5 eliminó la opción `timeout` de Bull
    // v3/v4, y forzarla con un cast solo daba una falsa sensación de límite. La
    // duración se acota por etapa (timeout del contenedor efímero y AbortController
    // en las llamadas al LLM), y los runs que queden colgados los rescata
    // BuilderStaleRunRecoveryService al arrancar el worker.
    const jobOptions: JobsOptions = {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
      // El identificador del job es el del propio run. Es lo que permite a
      // BuilderStaleRunRecoveryService preguntar a la cola si un run QUEUED
      // sigue encolado antes de decidir que está huérfano: sin un id estable
      // habría que recorrer la cola entera. Cada run tiene un UUID propio, de
      // modo que no puede colisionar con reejecuciones de la misma entrega.
      jobId: buildRunId,
      // ESC-BAJO-02: una avalancha de entregas no debe retrasar por igual la
      // reejecución que un docente lanza con la pantalla delante. Dentro de
      // cada prioridad se conserva el orden de llegada, de modo que ninguna
      // entrega de alumno adelanta a otra.
      priority:
        actor.role === UserRole.STUDENT
          ? BUILDER_JOB_PRIORITY.BATCH
          : BUILDER_JOB_PRIORITY.INTERACTIVE,
    };

    await this.builderRunsQueue.add(
      BUILDER_RUN_JOB_NAME,
      {
        buildRunId,
        deliveryId,
        actor,
        correlationId,
      } satisfies ExecuteBuildRunJobData,
      jobOptions,
    );
  }
}
