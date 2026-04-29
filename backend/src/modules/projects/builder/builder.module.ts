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
import { DockerInfrastructureModule } from '../../../shared/infrastructure/docker/docker-infrastructure.module';
import { InfrastructureModule } from '../../../shared/infrastructure/infrastructure.module';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { ProjectRuntimeModule } from '../runtime/project-runtime.module';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderService } from './application/builder.service';
import { BuilderBuildStageService } from './application/services/builder-build-stage.service';
import { BuilderCleanupStageService } from './application/services/builder-cleanup-stage.service';
import { BuilderAccessService } from './application/services/builder-access.service';
import { BuilderDeployStageService } from './application/services/builder-deploy-stage.service';
import { BuilderPreflightService } from './application/services/builder-preflight.service';

import { BuilderRunCommandsService } from './application/services/builder-run-commands.service';
import { BuilderRunQueriesService } from './application/services/builder-run-queries.service';
import { BuilderRunStateService } from './application/services/builder-run-state.service';
import { BuilderRunSupportService } from './application/services/builder-run-support.service';
import { BuilderRunTelemetryService } from './application/services/builder-run-telemetry.service';
import { BuilderStandardPipelineService } from './application/services/builder-standard-pipeline.service';
import { BuilderValidationStageService } from './application/services/builder-validation-stage.service';
import { BuilderWorkspaceService } from './application/services/builder-workspace.service';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';

import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRunEventEntity } from './domain/entities/build-run-event.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from './domain/evaluation/builder-evaluation-llm.service';
import { BuilderTechnicalFeedbackLlmService } from './domain/evaluation/builder-technical-feedback-llm.service';
import { BuilderRunEventsService } from './domain/events/builder-run-events.service';
import { BuilderStaticReviewService } from './domain/findings/builder-static-review.service';
import { StaticFindingsService } from './domain/findings/static-findings.service';
import { BuilderPlanLlmService } from './domain/planning/builder-plan-llm.service';
import { BuilderRepairLlmService } from './domain/planning/builder-repair-llm.service';
import { BuilderReportService } from './domain/reporting/builder-report.service';
import { DockerfileTemplateService } from './domain/templates/dockerfile-template.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { DockerExecutionService } from './infrastructure/execution/docker-execution.service';
import { DockerGarbageCollectorService } from './infrastructure/execution/docker-garbage-collector.service';
import { DockerWorkloadExecutionService } from './infrastructure/execution/docker-workload-execution.service';
import { ExecutionAdapterService } from './infrastructure/execution/execution-adapter.service';
import { ExecutionEnvironmentService } from './infrastructure/execution/execution-environment.service';
import { BuilderController } from './presentation/builder.controller';
import { BuilderProcessor } from './presentation/builder.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BUILDER_RUNS_QUEUE_NAME,
    }),
    DockerInfrastructureModule,
    InfrastructureModule,
    ProjectRuntimeModule,
    TypeOrmModule.forFeature([
      Project,
      ProjectAssignment,
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
    BuilderRunStateService,
    BuilderRunTelemetryService,
    BuilderRunSupportService,
    BuilderPreflightService,
    BuilderBuildStageService,
    BuilderDeployStageService,
    BuilderValidationStageService,
    BuilderCleanupStageService,
    BuilderStandardPipelineService,
    BuilderProcessor,
    StaticFindingsService,
    BuilderStaticReviewService,
    BuilderPlanLlmService,
    BuilderRepairLlmService,
    BuilderEvaluationLlmService,
    BuilderTechnicalFeedbackLlmService,
    BuilderRunEventsService,
    DockerfileTemplateService,
    ExecutionEnvironmentService,
    DockerExecutionService,
    DockerWorkloadExecutionService,
    ExecutionAdapterService,
    EvidenceService,
    BuilderReportService,
    DockerGarbageCollectorService,
  ],
  exports: [BuilderService],
})
export class BuilderModule implements OnModuleInit {
  constructor(private readonly builderService: BuilderService) {}

  async onModuleInit(): Promise<void> {
    await this.builderService.failStaleRunsOnStartup();
  }
}
