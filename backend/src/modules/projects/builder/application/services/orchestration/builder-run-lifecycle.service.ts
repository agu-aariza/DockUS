/**
 * @fileoverview Ciclo de vida de un `BuildRun` en ejecución (ARQ-003).
 *
 * Contexto:
 * - Extraído de `BuilderRunCommandsService`: CLAUDE.md/ARCHITECTURE.md
 *   documentaban al orquestador como único dueño de las transiciones de
 *   estado, pero el código las hacía aquí. Este servicio es ahora el único
 *   punto que muta `run.status`, invocado solo por `BuilderProcessor`;
 *   `BuilderRunCommandsService` queda con enqueue/cancel únicamente.
 * - Las escrituras de `DeliveryStatus` pasan por `DeliveryStatusService` en
 *   vez de mutar el repositorio de `Delivery` a mano: builder ya no
 *   reimplementa el estado de otro sub-contexto.
 *
 * @module BuilderRunLifecycleService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { OptimisticLockVersionMismatchError } from 'typeorm';
import type { IBuildRunRepository } from '../../../../domain/repositories/build-run.repository.interface';
import { BuildRun, BuildRunStatus } from '../../../domain/entities/build-run.entity';
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
    @Inject('IBuildRunRepository')
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
    // QUEUED. Esta comprobación es la primera línea de defensa; el lock
    // optimista (ARQ-013, @VersionColumn) cubre además la ventana residual
    // entre esta lectura y el save() de más abajo.
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

    run.status = BuildRunStatus.RUNNING;
    run.startedAt = new Date();
    try {
      await this.buildRunsRepository.save(run);
    } catch (error) {
      if (!(error instanceof OptimisticLockVersionMismatchError)) {
        throw error;
      }
      // ARQ-013: otro escritor (cancelRun, el sweep de huérfanos) ganó la
      // carrera entre el findOne de arriba y este save() — el lock optimista
      // lo detecta ahora en vez de pisarlo en silencio. No hay nada que
      // reintentar: si alguien ya tocó este run antes de que arrancara a
      // procesarse, lo correcto es no arrancar el pipeline.
      this.logger.warn(
        `processBuildRunJob: run ${run.id} modificado por otro escritor justo al recogerlo (version mismatch); se descarta sin ejecutar el pipeline.`,
      );
      return;
    }

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
      // esta ultima ventana entre ese chequeo y este save(). El release del
      // findOne+save (ARQ-013) es lo que cierra esa ventana: si un docente
      // cancelo el run justo despues de la relectura de abajo, el lock
      // optimista lo detecta en el save() y no pisa la cancelacion con el
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
   * Persiste el resultado calculado en `run`, salvo que otro escritor haya
   * cancelado el run en la ventana entre el chequeo de más arriba y este
   * punto (ARQ-013). Devuelve `false` si se descartó por cancelación.
   *
   * Dos capas de protección, no una: la relectura explícita cubre el caso
   * común (cancelación ya visible); el lock optimista (`@VersionColumn`)
   * cubre la ventana residual entre esa relectura y el `save()` en sí, que
   * ninguna relectura previa puede cerrar del todo. Si el conflicto no fue
   * por cancelación (p.ej. el sweep de huérfanos tocó el mismo run por otro
   * motivo en la misma ventana — extremadamente improbable pero no
   * imposible), se relee una vez más y se reintenta con los mismos datos en
   * vez de perder el resultado ya calculado.
   */
  private async saveRunResultUnlessCancelled(run: BuildRun): Promise<boolean> {
    const currentRun = await this.buildRunsRepository.findById(run.id);
    if (currentRun?.status === BuildRunStatus.CANCELLED) {
      return false;
    }

    try {
      await this.buildRunsRepository.save(run);
      return true;
    } catch (error) {
      if (!(error instanceof OptimisticLockVersionMismatchError)) {
        throw error;
      }

      const reread = await this.buildRunsRepository.findById(run.id);
      if (!reread) {
        throw error;
      }
      if (reread.status === BuildRunStatus.CANCELLED) {
        return false;
      }

      reread.status = run.status;
      reread.finishedAt = run.finishedAt;
      reread.llmAssessment = run.llmAssessment;
      reread.llmReasoning = run.llmReasoning;
      reread.warnings = run.warnings;
      reread.codeQualityFindings = run.codeQualityFindings;
      reread.report = run.report;
      reread.inputTokens = run.inputTokens;
      reread.outputTokens = run.outputTokens;
      reread.executionCostUsd = run.executionCostUsd;

      await this.buildRunsRepository.save(reread);
      return true;
    }
  }
}
