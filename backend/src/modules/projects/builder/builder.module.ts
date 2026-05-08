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
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { ProjectRuntimeModule } from '../runtime/project-runtime.module';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderService } from './application/builder.service';
import { BuilderAccessService } from './application/services/builder-access.service';

import { BuilderRunCommandsService } from './application/services/builder-run-commands.service';
import { BuilderRunQueriesService } from './application/services/builder-run-queries.service';
import { BuilderRunSupportService } from './application/services/builder-run-support.service';
import { BuilderWorkspaceService } from './application/services/builder-workspace.service';
import { BUILDER_RUN_JOB_NAME, BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuilderCacheManagerService } from './application/services/builder-cache-manager.service';
import { BuilderPedagogicalService } from './application/services/builder-pedagogical.service';

import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRunEventEntity } from './domain/entities/build-run-event.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { CodeQualityFindingEntity } from './domain/entities/code-quality-finding.entity';
import { BuilderLlmEvaluatorService } from './domain/llm/builder-llm-evaluator.service';
import { BuilderRunEventsService } from './domain/events/builder-run-events.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { BuilderLogTrimmer } from './infrastructure/utils/builder-log-trimmer.util';
import { BuilderController } from './presentation/builder.controller';
import { BuilderProcessor } from './presentation/builder.processor';
import { BuilderCodeQualityService } from './domain/llm/builder-code-quality.service';
import { BuilderQualityAggregationService } from './application/services/builder-quality-aggregation.service';

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
      CodeQualityFindingEntity,
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
    BuilderProcessor,
    BuilderLlmEvaluatorService,
    BuilderRunEventsService,
    EvidenceService,
    BuilderLogTrimmer,
    BuilderCacheManagerService,
    BuilderPedagogicalService,
    BuilderCodeQualityService,
    BuilderQualityAggregationService,
  ],
  exports: [BuilderService, BuilderQualityAggregationService],
})
export class BuilderModule implements OnModuleInit {
  constructor(private readonly builderService: BuilderService) {}

  async onModuleInit(): Promise<void> {
    await this.builderService.failStaleRunsOnStartup();
  }
}
