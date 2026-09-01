/**
 * @fileoverview Composición del pipeline asíncrono del Builder.
 *
 * Registra una única cola BullMQ, sus seis stages, los servicios de ciclo de
 * vida y la recuperación worker-side. La fachada BuilderModule solo expone los
 * puertos que necesitan otros bounded contexts.
 *
 * @module BuilderPipelineModule
 */

import { BullModule } from '@nestjs/bullmq';
import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { totalmem } from 'os';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { BuilderAiModule } from './builder-ai.module';
import { BuilderPersistenceModule } from './builder-persistence.module';
import { BuilderRuntimeModule } from './builder-runtime.module';
import { BuilderArtifactPersister } from './application/services/artifacts/builder-artifact-persister.service';
import { BuilderCompileStageHandler } from './application/services/stages/compile-stage.handler';
import { BuilderEvaluationStageHandler } from './application/services/stages/evaluation-stage.handler';
import { BuilderExecutionStageHandler } from './application/services/stages/execution-stage.handler';
import { BuilderPlanStageHandler } from './application/services/stages/plan-stage.handler';
import { BuilderQualityStageHandler } from './application/services/stages/quality-stage.handler';
import { BuilderReportStageHandler } from './application/services/stages/report-stage.handler';
import { BuilderImageRetentionService } from './application/services/orchestration/builder-image-retention.service';
import { BuilderPipelineOrchestrator } from './application/services/orchestration/builder-pipeline-orchestrator.service';
import { BuilderRunCancellationService } from './application/services/orchestration/builder-run-cancellation.service';
import { BuilderRunCommandsService } from './application/services/orchestration/builder-run-commands.service';
import { BuilderRunLifecycleService } from './application/services/orchestration/builder-run-lifecycle.service';
import { BuilderRunMetricsService } from './application/services/orchestration/builder-run-metrics.service';
import { BuilderRunSupportService } from './application/services/orchestration/builder-run-support.service';
import { BuilderStaleRunRecoveryService } from './application/services/orchestration/builder-stale-run-recovery.service';
import { assessWorkerCapacity } from './domain/worker-capacity.util';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuilderConfigProvider } from './domain/builder-config.provider';
import { PROCESS_ROLE } from '../../../process-role.module';
import type { ProcessRole } from '../../../process-role.module';
import { resolveWorkerConcurrency } from './presentation/builder.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BUILDER_RUNS_QUEUE_NAME,
    }),
    BuilderPersistenceModule,
    BuilderRuntimeModule,
    DeliveryStatusModule,
    BuilderAiModule,
  ],
  providers: [
    BuilderRunCommandsService,
    BuilderRunLifecycleService,
    BuilderRunCancellationService,
    BuilderRunSupportService,
    BuilderArtifactPersister,
    BuilderPlanStageHandler,
    BuilderCompileStageHandler,
    BuilderExecutionStageHandler,
    BuilderEvaluationStageHandler,
    BuilderQualityStageHandler,
    BuilderReportStageHandler,
    BuilderPipelineOrchestrator,
    BuilderRunMetricsService,
    BuilderStaleRunRecoveryService,
    BuilderImageRetentionService,
  ],
  exports: [BuilderRunCommandsService, BuilderRunLifecycleService],
})
export class BuilderPipelineModule implements OnModuleInit {
  constructor(
    private readonly builderStaleRunRecoveryService: BuilderStaleRunRecoveryService,
    private readonly builderConfigProvider: BuilderConfigProvider,
    @Inject(PROCESS_ROLE)
    private readonly processRole: ProcessRole,
  ) {}

  async onModuleInit(): Promise<void> {
    // El barrido de runs huérfanos solo lo dispara el worker: un reinicio de la
    // API no debe marcar FAILED un run que el worker está procesando. La
    // composición de procesos declara el rol (ver WorkerModule/ApiModule) en
    // vez de leerlo de un env-flag global.
    if (this.processRole !== 'worker') {
      return;
    }
    this.warnIfCapacityExceedsHostRam();
    await this.builderStaleRunRecoveryService.failStaleRunsOnStartup();
  }

  /**
   * Avisa si `concurrencia × límite de memoria` se acerca a la RAM del host.
   * No impide arrancar: es una heurística para detectar configuraciones que
   * podrían provocar un OOM del worker y cancelar todas las evaluaciones activas.
   */
  private warnIfCapacityExceedsHostRam(): void {
    const assessment = assessWorkerCapacity({
      concurrency: resolveWorkerConcurrency(),
      memoryLimit: this.builderConfigProvider.executionMemoryLimit,
      totalRamBytes: totalmem(),
    });

    if (!assessment?.exceedsSafeFraction) {
      return;
    }

    const gb = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1);
    new Logger(BuilderPipelineModule.name).warn(
      JSON.stringify({
        event: 'builder_worker_capacity_exceeds_host_ram',
        concurrency: assessment.concurrency,
        perContainer: this.builderConfigProvider.executionMemoryLimit,
        worstCaseGb: gb(assessment.worstCaseBytes),
        hostRamGb: gb(assessment.totalRamBytes),
        accion:
          'Reduzca BUILDER_WORKER_CONCURRENCY o BUILDER_BATCH_MEMORY_LIMIT.',
      }),
    );
  }
}
