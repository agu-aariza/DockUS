/**
 * @fileoverview Modulo Builder MVP dentro del dominio de proyectos.
 *
 * Contexto:
 * - Registra endpoint y servicio para pipeline LLM-first efímero.
 * - Reutiliza entidades de entregas y storage para recolectar artefactos.
 *
 * @module BuilderModule
 */

import { BullModule } from '@nestjs/bullmq';
import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { totalmem } from 'os';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerInfrastructureModule } from '../../../shared/infrastructure/docker/docker-infrastructure.module';
import { InfrastructureModule } from '../../../shared/infrastructure/infrastructure.module';
import { PROCESS_ROLE } from '../../../process-role.module';
import type { ProcessRole } from '../../../process-role.module';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { BuildRunRepository } from '../infrastructure/database/build-run.repository';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { Project } from '../entities/project.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderAccessService } from './application/services/workspace/builder-access.service';

import { BuilderRunCommandsService } from './application/services/orchestration/builder-run-commands.service';
import { BuilderRunLifecycleService } from './application/services/orchestration/builder-run-lifecycle.service';
import { BuilderRunCancellationService } from './application/services/orchestration/builder-run-cancellation.service';
import { BuilderRunQueriesService } from './application/services/orchestration/builder-run-queries.service';
import { BuilderRunSupportService } from './application/services/orchestration/builder-run-support.service';
import { BuilderWorkspaceService } from './application/services/workspace/builder-workspace.service';
import { SourceCodePayloadBuilder } from './application/services/workspace/source-code-payload-builder.service';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuilderEnvironmentImageService } from './application/services/workspace/builder-environment-image.service';
import { BuilderPedagogicalService } from './application/services/evaluation/builder-pedagogical.service';
import { BuilderRecipeCompiler } from './application/services/compilation/builder-recipe-compiler.service';
import { BuilderHallucinationGuard } from './application/services/evaluation/builder-hallucination-guard.service';
import { BuilderReportComposer } from './application/services/evaluation/builder-report-composer.service';
import { BuilderArtifactPersister } from './application/services/artifacts/builder-artifact-persister.service';

import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRunEventEntity } from './domain/entities/build-run-event.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { CodeQualityFindingEntity } from './domain/entities/code-quality-finding.entity';
import { BuildRunChatMessage } from './domain/entities/build-run-chat-message.entity';
import { LlmConfiguration } from './domain/entities/llm-configuration.entity';
import { BuilderConfigProvider } from './domain/builder-config.provider';
import { BuilderLlmEvaluatorService } from './application/services/ai/builder-llm-evaluator.service';
import { BuilderLlmChatService } from './application/services/ai/builder-llm-chat.service';
import { BuilderRunEventsService } from './infrastructure/events/builder-run-events.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { BuilderLogTrimmer } from './infrastructure/utils/builder-log-trimmer.util';
import { BuilderController } from './presentation/builder.controller';
import { BuilderCodeQualityService } from './application/services/ai/builder-code-quality.service';
import { BuilderQualityAggregationService } from './application/services/evaluation/builder-quality-aggregation.service';
import { BuilderPlanStageHandler } from './application/services/stages/plan-stage.handler';
import { BuilderCompileStageHandler } from './application/services/stages/compile-stage.handler';
import { BuilderExecutionStageHandler } from './application/services/stages/execution-stage.handler';
import { BuilderEvaluationStageHandler } from './application/services/stages/evaluation-stage.handler';
import { BuilderQualityStageHandler } from './application/services/stages/quality-stage.handler';
import { BuilderReportStageHandler } from './application/services/stages/report-stage.handler';
import { BuilderPipelineOrchestrator } from './application/services/orchestration/builder-pipeline-orchestrator.service';
import { BuilderRunMetricsService } from './application/services/orchestration/builder-run-metrics.service';
import { BuilderStaleRunRecoveryService } from './application/services/orchestration/builder-stale-run-recovery.service';
import { BuilderImageRetentionService } from './application/services/orchestration/builder-image-retention.service';
import { BuilderLlmConfigService } from './infrastructure/config/builder-llm-config.service';
import { BuilderLlmProviderTester } from './infrastructure/config/builder-llm-provider-tester.service';
import { BuilderRunCostService } from './application/services/ai/builder-run-cost.service';
import { BuilderLlmDispatcherService } from './application/services/ai/builder-llm-dispatcher.service';
import { BuilderSpendQuotaService } from './application/services/orchestration/builder-spend-quota.service';
import { assessWorkerCapacity } from './domain/worker-capacity.util';
import { resolveWorkerConcurrency } from './presentation/builder.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BUILDER_RUNS_QUEUE_NAME,
    }),
    DockerInfrastructureModule,
    InfrastructureModule,
    TypeOrmModule.forFeature([
      Project,
      ProjectAssignment,
      Delivery,
      StorageObject,
      BuildRun,
      BuildRunArtifact,
      BuildRunEventEntity,
      CodeQualityFindingEntity,
      BuildRunChatMessage,
      LlmConfiguration,
    ]),
    StorageInfrastructureModule,
    DeliveryStatusModule,
  ],
  controllers: [BuilderController],
  providers: [
    {
      provide: 'IBuildRunRepository',
      useClass: BuildRunRepository,
    },
    BuilderConfigProvider,
    BuilderAccessService,
    BuilderWorkspaceService,
    SourceCodePayloadBuilder,
    BuilderRunQueriesService,
    BuilderRunCommandsService,
    BuilderRunLifecycleService,
    BuilderRunCancellationService,
    BuilderRunSupportService,
    BuilderLlmEvaluatorService,
    BuilderLlmChatService,
    BuilderRunEventsService,
    EvidenceService,
    BuilderLogTrimmer,
    BuilderEnvironmentImageService,
    BuilderPedagogicalService,
    BuilderCodeQualityService,
    BuilderQualityAggregationService,
    BuilderRecipeCompiler,
    BuilderHallucinationGuard,
    BuilderReportComposer,
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
    BuilderLlmConfigService,
    BuilderLlmProviderTester,
    BuilderRunCostService,
    BuilderLlmDispatcherService,
    BuilderSpendQuotaService,
  ],
  exports: [
    BuilderQualityAggregationService,
    BuilderRunCommandsService,
    BuilderRunLifecycleService,
  ],
})
export class BuilderModule implements OnModuleInit {
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
    // vez de leerlo de un env-flag global (ARQ-006).
    if (this.processRole !== 'worker') {
      return;
    }
    this.warnIfCapacityExceedsHostRam();
    await this.builderStaleRunRecoveryService.failStaleRunsOnStartup();
  }

  /**
   * Avisa si `concurrencia × límite de memoria` se acerca a la RAM del host
   * (ESC-MED-04). No impide arrancar: es una heurística, y el operador puede
   * saber algo que esta cuenta no. Pero un OOM del worker se lleva todas las
   * evaluaciones en curso, así que la cifra conviene verla antes.
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
    new Logger(BuilderModule.name).warn(
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
