/**
 * @fileoverview Ciclo de vida de un `BuildRun` en ejecución.
 *
 * Contexto:
 * - Es el único punto que muta `run.status`, invocado por `BuilderProcessor`;
 *   `BuilderRunCommandsService` queda con enqueue/cancel únicamente.
 * - Las escrituras de `DeliveryStatus` pasan por `DeliveryStatusService` en
 * vez de mutar el repositorio de `Delivery` a mano: builder ya no
 * reimplementa el estado de otro sub-contexto.
 *
 * @module BuilderRunLifecycleService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  BuildRunResultPatch,
  IBuildRunRepository,
} from '../../../domain/repositories/build-run.repository.interface';
import { BUILD_RUN_REPOSITORY } from '../../../domain/repositories/build-run.repository.interface';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import { BuilderStudentStage } from '../../../domain/builder.types';
import { DeliveryStatus } from '../../../../deliveries/entities/delivery.entity';
import { DeliveryStatusService } from '../../../../deliveries/delivery-status.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { ExecuteBuildRunJobData } from '../builder-application.types';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunMetricsService } from './builder-run-metrics.service';
import { BuilderRunCostService } from '../ai/builder-run-cost.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { RunCancelledError } from './run-cancelled.error';

@Injectable()
export class BuilderRunLifecycleService {
  private readonly logger = new Logger(BuilderRunLifecycleService.name);
  private readonly promptVersion: string;

  constructor(
    @Inject(BUILD_RUN_REPOSITORY)
    private readonly buildRunsRepository: IBuildRunRepository,
    private readonly builderAccessService: BuilderAccessService,
    private readonly deliveryStatusService: DeliveryStatusService,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderPipelineOrchestrator: BuilderPipelineOrchestrator,
    private readonly builderRunMetricsService: BuilderRunMetricsService,
    private readonly builderRunCostService: BuilderRunCostService,
    private readonly builderConfigProvider: BuilderConfigProvider,
  ) {
    this.promptVersion = this.builderConfigProvider.promptVersion;
  }

  async processBuildRunJob(data: ExecuteBuildRunJobData): Promise<void> {
    const run = await this.buildRunsRepository.findById(data.buildRunId);
    if (!run) return;
    // Idempotencia: si este job llega aquí una segunda vez (reencolado por
    // BullMQ tras un "stalled", redrive manual, etc.) el estado ya no será
    // QUEUED. Esta comprobación es la primera línea de defensa; el UPDATE
    // atómico condicionado de más abajo (claimQueuedRun, ) cubre
    // además la ventana residual entre esta lectura y esa transición.
    if (run.status !== BuildRunStatus.QUEUED) {
      this.logger.warn(
        `processBuildRunJob: run ${run.id} ignorado, estado '${run.status}' distinto de QUEUED (posible reprocesado duplicado).`,
      );
      return;
    }

    const delivery = await this.builderAccessService.findDeliveryOrThrow(
      data.deliveryId,
    );

    await this.deliveryStatusService.updateStatusInternal(
      delivery.id,
      DeliveryStatus.IN_REVIEW,
    );

    // UPDATE atómico condicionado a QUEUED, no lectura-modificación-
    // escritura. Reemplaza el antiguo `run.status = RUNNING; save(run)`, que
    // dependía de que `repository.save()` de TypeORM aplicara el optimistic
    // lock del `@VersionColumn` de forma atómica — una sonda directa contra
    // Postgres demostró que no lo hace: un escritor obsoleto podía pisar una
    // cancelación ya confirmada sin lanzar ninguna excepción.
    const claimed = await this.buildRunsRepository.claimQueuedRun(
      run.id,
      new Date(),
    );
    if (!claimed) {
      // Otro escritor (cancelRun, el sweep de huérfanos) ganó la carrera
      // entre el findById de arriba y este claim: no hay nada que
      // reintentar, lo correcto es no arrancar el pipeline.
      this.logger.warn(
        `processBuildRunJob: run ${run.id} ya no estaba QUEUED al reclamarlo (otro escritor gano la carrera); se descarta sin ejecutar el pipeline.`,
      );
      return;
    }
    run.status = BuildRunStatus.RUNNING;
    run.startedAt = new Date();

    await this.builderRunSupportService.emitEvent({
      buildRunId: run.id,
      eventType: 'RUN_STARTED',
      runStatus: BuildRunStatus.RUNNING,
      message: 'Ejecucion iniciada (Pipeline Efimero LLM)',
      payload: { studentStage: 'building' satisfies BuilderStudentStage },
    });

    try {
      const pipelineResult = await this.builderPipelineOrchestrator.runPipeline(
        run,
        delivery,
      );

      run.status = BuildRunStatus.SUCCESS;
      run.finishedAt = new Date();
      run.llmAssessment = pipelineResult.assessment;
      run.llmReasoning = `[PLANNER THOUGHT]: ${pipelineResult.planAssessment.thought}\n\n[AUDITOR THOUGHT]: ${pipelineResult.assessment.thought}`;
      run.warnings = pipelineResult.warnings;
      run.codeQualityFindings = pipelineResult.qualityFindings;
      run.report = pipelineResult.report;

      const cost = await this.builderRunCostService.summarize(
        pipelineResult.llmUsages,
      );
      run.inputTokens = cost.inputTokens;
      run.outputTokens = cost.outputTokens;
      run.executionCostUsd = cost.costUsd;

      this.builderRunMetricsService.logRunMetrics(
        run.id,
        this.promptVersion,
        pipelineResult.assessment,
        pipelineResult.qualityFindings,
      );

      // Guarda frente a la carrera con cancelRun: el orquestador ya comprueba
      // la cancelacion entre etapas y durante la ejecucion Docker, pero queda
      // esta ultima ventana entre ese chequeo y la persistencia del
      // resultado. El UPDATE atómico condicionado a RUNNING es lo
      // que cierra esa ventana: si un docente cancelo el run justo antes,
      // completeRunningRun afecta 0 filas y no pisa la cancelacion con el
      // resultado calculado en memoria.
      const saved = await this.saveRunResultUnlessCancelled(run);
      if (!saved) {
        this.logger.warn(
          `processBuildRunJob: run ${run.id} fue cancelado mientras se procesaba; se descarta el resultado calculado.`,
        );
        return;
      }

      await this.deliveryStatusService.updateStatusInternal(
        delivery.id,
        DeliveryStatus.EVALUATED,
      );

      await this.builderRunSupportService.emitEvent({
        buildRunId: run.id,
        eventType: 'RUN_COMPLETED',
        runStatus: BuildRunStatus.SUCCESS,
        message: 'Evaluacion completada con exito.',
        payload: { studentStage: 'completed' satisfies BuilderStudentStage },
      });
    } catch (error) {
      if (error instanceof RunCancelledError) {
        // cancelRun ya dejo el run en CANCELLED con un UPDATE atomico: no hay
        // FAILED que marcar ni resultado que persistir. La entrega se deja tal
        // cual, igual que en la guarda de mas arriba: permanece IN_REVIEW
        // hasta que se reencole un nuevo intento.
        this.logger.warn(
          `processBuildRunJob: run ${run.id} cancelado cooperativamente durante el pipeline.`,
        );
        return;
      }

      await this.builderRunSupportService.markRunAsFailed(
        run.id,
        this.builderRunSupportService.toErrorMessage(error),
      );
      // La entrega se marca EVALUATED aunque el run falle, deliberadamente:
      // sacarla de IN_REVIEW evita que quede colgada. El estado real del
      // intento se lee del BuildRun (FAILED), no del Delivery.
      await this.deliveryStatusService.updateStatusInternal(
        delivery.id,
        DeliveryStatus.EVALUATED,
      );
      throw error;
    }
    // El workspace lo limpia el propio orquestador (posee su ciclo de vida).
  }

  /**
   * Persiste el resultado calculado en `run` mediante un único UPDATE
   * atómico condicionado a que el run siga RUNNING. Devuelve
   * `false` si ya no lo estaba — cancelado por `cancelRun`, o marcado FAILED
   * por otra vía (p. ej. el sweep de huérfanos) mientras el pipeline seguía
   * en curso — y en ese caso el resultado calculado se descarta sin
   * reintentar: sea cual sea el motivo, esa transición ya la decidió otro
   * escritor y no debe pisarse.
   *
   * El UPDATE condicionado cubre exactamente el mismo caso sin exponer una
   * ventana de lectura-modificación-escritura.
   */
  private async saveRunResultUnlessCancelled(run: BuildRun): Promise<boolean> {
    const patch: BuildRunResultPatch = {
      finishedAt: run.finishedAt!,
      llmAssessment: run.llmAssessment,
      llmReasoning: run.llmReasoning,
      warnings: run.warnings,
      codeQualityFindings: run.codeQualityFindings,
      report: run.report,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      executionCostUsd: run.executionCostUsd,
    };

    return this.buildRunsRepository.completeRunningRun(run.id, patch);
  }
}
