/**
 * @fileoverview Modulo Builder MVP dentro del dominio de proyectos.
 *
 * Contexto:
 * - Registra endpoint y servicio para pipeline Python-first.
 * - Reutiliza entidades de entregas y storage para recolectar artefactos.
 *
 * @module BuilderModule
 */

import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfrastructureModule } from '../../../shared/infrastructure/infrastructure.module';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderService } from './application/builder.service';
import { BuilderBuildStageService } from './application/services/builder-build-stage.service';
import { BuilderCleanupStageService } from './application/services/builder-cleanup-stage.service';
import { BuilderAccessService } from './application/services/builder-access.service';
import { BuilderDeployStageService } from './application/services/builder-deploy-stage.service';
import { BuilderFrozenReplayPipelineService } from './application/services/builder-frozen-replay-pipeline.service';
import { BuilderReproducibilityService } from './application/services/builder-reproducibility.service';
import { BuilderRunCommandsService } from './application/services/builder-run-commands.service';
import { BuilderRunQueriesService } from './application/services/builder-run-queries.service';
import { BuilderRunSupportService } from './application/services/builder-run-support.service';
import { BuilderStandardPipelineService } from './application/services/builder-standard-pipeline.service';
import { BuilderValidationStageService } from './application/services/builder-validation-stage.service';
import { BuilderWorkspaceService } from './application/services/builder-workspace.service';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuilderRunComparisonService } from './domain/comparison/builder-run-comparison.service';
import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRunEventEntity } from './domain/entities/build-run-event.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from './domain/evaluation/builder-evaluation-llm.service';
import { BuilderRunEventsService } from './domain/events/builder-run-events.service';
import { StaticFindingsService } from './domain/findings/static-findings.service';
import { BuilderPlanLlmService } from './domain/planning/builder-plan-llm.service';
import { BuilderReportService } from './domain/reporting/builder-report.service';
import { DockerfileTemplateService } from './domain/templates/dockerfile-template.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from './infrastructure/execution/execution-adapter.service';
import { ExecutionEnvironmentService } from './infrastructure/execution/execution-environment.service';
import { KubectlExecutionService } from './infrastructure/execution/kubectl-execution.service';
import { KubernetesManifestService } from './infrastructure/execution/kubernetes-manifest.service';
import { KubernetesObservabilityService } from './infrastructure/execution/kubernetes-observability.service';
import { KubernetesRuntimeExecutionService } from './infrastructure/execution/kubernetes-runtime-execution.service';
import { KubernetesWorkloadExecutionService } from './infrastructure/execution/kubernetes-workload-execution.service';
import { BuilderController } from './presentation/builder.controller';
import { BuilderProcessor } from './presentation/builder.processor';
import { BuilderRunStreamService } from './presentation/services/builder-run-stream.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BUILDER_RUNS_QUEUE_NAME,
    }),
    InfrastructureModule,
    TypeOrmModule.forFeature([
      Delivery,
      StorageObject,
      BuildRun,
      BuildRunArtifact,
      BuildRunEventEntity,
    ]),
    StorageInfrastructureModule,
  ],
  controllers: [BuilderController],
  providers: [
    BuilderService,
    BuilderAccessService,
    BuilderWorkspaceService,
    BuilderRunQueriesService,
    BuilderRunCommandsService,
    BuilderRunSupportService,
    BuilderReproducibilityService,
    BuilderBuildStageService,
    BuilderDeployStageService,
    BuilderValidationStageService,
    BuilderCleanupStageService,
    BuilderStandardPipelineService,
    BuilderFrozenReplayPipelineService,
    BuilderProcessor,
    StaticFindingsService,
    BuilderPlanLlmService,
    BuilderEvaluationLlmService,
    BuilderRunEventsService,
    BuilderRunComparisonService,
    DockerfileTemplateService,
    ExecutionEnvironmentService,
    KubectlExecutionService,
    KubernetesManifestService,
    KubernetesObservabilityService,
    KubernetesRuntimeExecutionService,
    KubernetesWorkloadExecutionService,
    ExecutionAdapterService,
    EvidenceService,
    BuilderReportService,
    BuilderRunStreamService,
  ],
  exports: [BuilderService],
})
export class BuilderModule implements OnModuleInit {
  constructor(private readonly builderService: BuilderService) {}

  async onModuleInit(): Promise<void> {
    await this.builderService.failStaleRunsOnStartup();
  }
}
