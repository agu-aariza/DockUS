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
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderService } from './application/builder.service';
import { BUILDER_RUNS_QUEUE_NAME } from './domain/builder.constants';
import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { BuilderEvaluationLlmService } from './domain/evaluation/builder-evaluation-llm.service';
import { StaticFindingsService } from './domain/findings/static-findings.service';
import { BuilderPlanLlmService } from './domain/planning/builder-plan-llm.service';
import { BuilderReportService } from './domain/reporting/builder-report.service';
import { DockerfileTemplateService } from './domain/templates/dockerfile-template.service';
import { EvidenceService } from './infrastructure/evidence/evidence.service';
import { ExecutionAdapterService } from './infrastructure/execution/execution-adapter.service';
import { BuilderController } from './presentation/builder.controller';
import { BuilderProcessor } from './presentation/builder.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BUILDER_RUNS_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature([
      Delivery,
      StorageObject,
      BuildRun,
      BuildRunArtifact,
    ]),
    StorageInfrastructureModule,
  ],
  controllers: [BuilderController],
  providers: [
    BuilderService,
    BuilderProcessor,
    StaticFindingsService,
    BuilderPlanLlmService,
    BuilderEvaluationLlmService,
    DockerfileTemplateService,
    ExecutionAdapterService,
    EvidenceService,
    BuilderReportService,
  ],
  exports: [BuilderService],
})
export class BuilderModule implements OnModuleInit {
  constructor(private readonly builderService: BuilderService) {}

  async onModuleInit(): Promise<void> {
    await this.builderService.failStaleRunsOnStartup();
  }
}
