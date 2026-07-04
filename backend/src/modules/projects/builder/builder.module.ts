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
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerInfrastructureModule } from '../../../shared/infrastructure/docker/docker-infrastructure.module';
import { InfrastructureModule } from '../../../shared/infrastructure/infrastructure.module';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { BuildRunRepository } from '../infrastructure/database/build-run.repository';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderAccessService } from './application/services/workspace/builder-access.service';

import { BuilderRunCommandsService } from './application/services/orchestration/builder-run-commands.service';
import { BuilderRunQueriesService } from './application/services/orchestration/builder-run-queries.service';
import { BuilderRunSupportService } from './application/services/orchestration/builder-run-support.service';
import { BuilderWorkspaceService } from './application/services/workspace/builder-workspace.service';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuilderCacheManagerService } from './application/services/workspace/builder-cache-manager.service';
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
import { BuilderLlmEvaluatorService } from './domain/ai/builder-llm-evaluator.service';
import { BuilderLlmChatService } from './domain/ai/builder-llm-chat.service';
import { BuilderRunEventsService } from './domain/events/builder-run-events.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { BuilderLogTrimmer } from './infrastructure/utils/builder-log-trimmer.util';
import { BuilderController } from './presentation/builder.controller';
import { BuilderProcessor } from './presentation/builder.processor';
import { BuilderCodeQualityService } from './domain/ai/builder-code-quality.service';
import { BuilderQualityAggregationService } from './application/services/evaluation/builder-quality-aggregation.service';
import { BuilderPlanStageHandler } from './application/services/stages/plan-stage.handler';
import { BuilderCompileStageHandler } from './application/services/stages/compile-stage.handler';
import { BuilderExecutionStageHandler } from './application/services/stages/execution-stage.handler';
import { BuilderEvaluationStageHandler } from './application/services/stages/evaluation-stage.handler';
import { BuilderQualityStageHandler } from './application/services/stages/quality-stage.handler';
import { BuilderReportStageHandler } from './application/services/stages/report-stage.handler';

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
    ]),
    StorageInfrastructureModule,
  ],
  controllers: [BuilderController],
  providers: [
    {
      provide: 'IBuildRunRepository',
      useClass: BuildRunRepository,
    },
    BuilderAccessService,
    BuilderWorkspaceService,
    BuilderRunQueriesService,
    BuilderRunCommandsService,
    BuilderRunSupportService,
    BuilderProcessor,
    BuilderLlmEvaluatorService,
    BuilderLlmChatService,
    BuilderRunEventsService,
    EvidenceService,
    BuilderLogTrimmer,
    BuilderCacheManagerService,
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
  ],
  exports: [BuilderQualityAggregationService],
})
export class BuilderModule implements OnModuleInit {
  constructor(
    private readonly builderRunCommandsService: BuilderRunCommandsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.builderRunCommandsService.failStaleRunsOnStartup();
  }
}
